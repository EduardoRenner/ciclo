import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { redigirParaTrilha } from '@/server/audit/write'

/**
 * Achado da auditoria de 2026-08-28 — o ponto cego do `jsonb`.
 *
 * `writeAudit` recebe `after: cliente` em `POST /api/v1/clients` e `before`+`after` no `PATCH`. O
 * que vai para `audit_log` é a linha inteira: nome, telefone, e-mail, nascimento, CPF
 * (`document`), endereço, `emergency_contact` (nome e telefone de um TERCEIRO, que nunca foi
 * cliente de ninguém) e `preferences`. A mesma linha vai para `idempotency_keys.response_body`,
 * porque o corpo da resposta É a cliente.
 *
 * `eliminarCliente` nunca tocou nenhuma das duas: o sistema respondia `anonymized: true`, a tela
 * dizia "Cliente eliminada", e o cadastro completo seguia legível para `owner`, `manager` e
 * `finance` — que é quem a política `audit_read` deixa ler.
 *
 * E `preferences` tem um campo `alergia` em SEIS das sete verticais de `src/lib/preferencias.ts`.
 * Alergia é dado de saúde, e a regra 9 do `CLAUDE.md` não abre exceção para trilha.
 *
 * Por que a guarda `lgpd-cobertura` não pegava: ela procura tabela com `references clients(id)` e
 * coluna de tipo textual. `audit_log` não referencia `clients` (o vínculo é `entity_id`, um uuid
 * solto), `idempotency_keys` não referencia nem `tenants`, e o dado mora em `jsonb`. Este arquivo
 * é a guarda do que aquele detector não enxerga.
 */

const LGPD = 'src/server/services/lgpd.ts'
const MIGRATIONS = 'supabase/migrations'
const RPC = 'redigir_trilha_do_cliente'

function semComentarios(caminho: string): string {
  return readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('a trilha não guarda dado de saúde (regra 9)', () => {
  /** Uma linha de `clients` como ela chega em `after`, com os campos do achado. */
  const clienteDeVerdade = {
    id: 'c-1',
    name: 'Maria',
    phone_e164: '+5551999990000',
    document: '000.000.000-00',
    emergency_contact: { nome: 'Irmã da Maria', telefone: '+5551988880000' },
    preferences: { alergia: 'acetona, resina', obs: 'redemoinho' },
  }

  it('o redator é exercitado de verdade — não é uma lista conferida contra si mesma', () => {
    const saida = redigirParaTrilha(clienteDeVerdade) as Record<string, unknown>
    expect(saida, 'redigirParaTrilha devolveu algo que não é objeto').toBeTypeOf('object')
    expect(saida.name, 'o redator apagou o que NÃO devia — a trilha ficaria sem valor nenhum').toBe('Maria')
  })

  it('preferences sai redigido — é lá que mora a alergia nas seis verticais', () => {
    const saida = redigirParaTrilha(clienteDeVerdade) as Record<string, unknown>
    expect(
      saida.preferences,
      '`clients.preferences` tem campo `alergia` em src/lib/preferencias.ts. Dado de saúde não ' +
        'entra em log, Sentry nem trilha (regra 9 do CLAUDE.md) — redija antes de gravar.',
    ).toBe('[redigido]')
  })

  it('a ficha do cofre continua redigida em qualquer profundidade', () => {
    const saida = redigirParaTrilha({ nivel1: { nivel2: { answers: { gravidez: 'sim' }, ciphertext: 'x' } } }) as never
    const fundo = (saida as { nivel1: { nivel2: Record<string, unknown> } }).nivel1.nivel2
    expect(fundo.answers).toBe('[redigido]')
    expect(fundo.ciphertext).toBe('[redigido]')
  })
})

describe('a eliminação alcança o que o jsonb esconde', () => {
  const fonte = semComentarios(LGPD)

  it('a leitura não voltou vazia', () => {
    expect(fonte.length, `${LGPD} veio vazio — o teste passaria por não achar nada`).toBeGreaterThan(2_000)
    expect(fonte, 'eliminarCliente sumiu do arquivo — este teste precisa ser revisto junto').toMatch(/export async function eliminarCliente/)
  })

  it('a chamada vai pela chave de serviço, não pelo cliente de quem está logado', () => {
    expect(fonte, 'lgpd.ts não usa mais withTenant para a redação da trilha').toMatch(/withTenant\(tenantId/)
  })

  it('eliminarCliente CHAMA a RPC — o nome solto não conta', () => {
    // Casa com a chamada, não com o nome: este arquivo e o próprio JSDoc de `lgpd.ts` citam
    // `redigir_trilha_do_cliente` na explicação. É a armadilha nº 1 da tabela do CLAUDE.md.
    expect(
      new RegExp('\\.rpc\\(\\s*[\'"`]' + RPC + '[\'"`]').test(fonte),
      'eliminarCliente não chama mais a RPC que redige `audit_log` e `idempotency_keys` — o CPF, o ' +
        'endereço e o contato de emergência voltam a sobreviver à eliminação',
    ).toBe(true)
  })

  it('a chamada vem DEPOIS de gravar anonymized_at — a RPC recusa cliente ativa', () => {
    const anonimizou = fonte.indexOf('anonymized_at: agora')
    const chamou = fonte.search(new RegExp('\\.rpc\\(\\s*[\'"`]' + RPC))
    expect(anonimizou, 'não achei onde `anonymized_at` é gravado').toBeGreaterThan(-1)
    expect(chamou, 'não achei a chamada da RPC').toBeGreaterThan(-1)
    expect(
      chamou,
      'a RPC exige `anonymized_at is not null` para rodar. Chamada antes da anonimização, ela ' +
        'levanta exceção e a eliminação inteira falha.',
    ).toBeGreaterThan(anonimizou)
  })

  it('a RPC confere quem chama — security definer sem trava é ferramenta de sumir com rastro', () => {
    const migration = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
      .find((sql) => new RegExp('create\\s+(or replace\\s+)?function\\s+(public\\.)?' + RPC).test(sql))
    expect(migration, `nenhuma migration declara ${RPC}`).toBeDefined()

    const corpo = migration!.toLowerCase()
    expect(corpo, 'a função precisa fixar o search_path').toMatch(/set search_path/)
    expect(corpo, 'sem exigir anonymized_at, dá para redigir a trilha de uma cliente ATIVA').toMatch(/anonymized_at is not null/)
    expect(corpo, 'a linha da trilha nunca é apagada (regra 11) — só o conteúdo').not.toMatch(/delete from public\.audit_log/)

    // O EXECUTE de fábrica é de `public`. Sem o revoke, qualquer autenticado teria em mãos uma
    // `security definer` que redige trilha — que é exatamente a ferramenta de quem quer sumir
    // com o próprio rastro.
    expect(corpo, 'falta revogar o execute de public/anon/authenticated').toMatch(/revoke all on function public\.redigir_trilha_do_cliente[^;]*from[^;]*authenticated/)
    const concessoes = corpo.match(/grant execute on function public\.redigir_trilha_do_cliente[^;]*;/g) ?? []
    expect(concessoes, 'nenhum grant encontrado — a função ficaria inexecutável').not.toEqual([])
    for (const g of concessoes) {
      expect(g.includes('authenticated') || g.includes('anon'), `so service_role pode executar: ${g}`).toBe(false)
    }
  })
})
