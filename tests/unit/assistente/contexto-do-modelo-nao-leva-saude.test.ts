import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { FERRAMENTAS, semDadoDeSaude } from '@/server/assistente/ferramentas'
import type { ResumoHoje } from '@/server/services/resumo-hoje'

import { semComentarios } from '../../helpers/fonte'

/**
 * Duas das quatro regras invioláveis do `docs/26` §2 não tinham guarda nenhuma. Esta cobre as duas.
 *
 * > "Dado de saúde nunca entra no contexto. `vault`, `health_records` e anamnese ficam fora,
 * > **por construção**, não por instrução no prompt."
 *
 * > "Escrita exige confirmação humana. O assistente devolve uma proposta; quem executa é o
 * > endpoint normal, com o clique do dono."
 *
 * A primeira estava sendo VIOLADA, e foi achada em 2026-09-09: `resumo_de_hoje` devolvia o retorno
 * inteiro de `resumoDeHoje`, e cada linha do dia carrega `clients.health_records[].has_alert` — a
 * tela precisa dele para acender o sinal ao lado do nome. O booleano ia com o NOME da pessoa para
 * o Gemini.
 *
 * A segunda estava sendo cumprida, e é a mais cara de perder: é ela que faz o assistente **propor**
 * em vez de agir. Uma ferramenta nova com `.insert(` passaria despercebida — nada quebra, nenhum
 * teste fica vermelho, e o assistente ganha o direito de escrever no banco sem clique nenhum.
 */

const FONTE = 'src/server/assistente/ferramentas.ts'

/** Uma linha do dia com o dado que a regra tira. É o cenário que a guarda existe para cobrir. */
function linhaComAlerta(id: string) {
  return {
    id,
    starts_at: '2026-09-09T13:00:00Z',
    ends_at: '2026-09-09T14:00:00Z',
    status: 'confirmed',
    price_cents: 8000,
    client_note: null,
    address: null,
    professional_id: null,
    clients: { name: 'Fulana', health_records: [{ has_alert: true }] },
    services: { name: 'Corte' },
    professionals: { display_name: 'Ana' },
  }
}

/** Todas as chaves do objeto, em profundidade — o dado pode vir aninhado em qualquer lista. */
function chavesEmProfundidade(valor: unknown, achadas: string[] = []): string[] {
  if (Array.isArray(valor)) {
    for (const item of valor) chavesEmProfundidade(item, achadas)
  } else if (valor && typeof valor === 'object') {
    for (const [chave, dentro] of Object.entries(valor)) {
      achadas.push(chave)
      chavesEmProfundidade(dentro, achadas)
    }
  }
  return achadas
}

describe('dado de saúde não entra no contexto do modelo', () => {
  const cru = {
    revenueTodayCents: 12_000,
    nextClient: linhaComAlerta('a1'),
    alerts: [linhaComAlerta('a2')],
    restOfDay: [linhaComAlerta('a3')],
    stockAlerts: [],
  } as unknown as ResumoHoje

  it('o cenário REALMENTE tem o dado — senão a guarda não prova nada', () => {
    // Piso contra o próprio teste: sem isto, um cenário sem alerta passaria por "limpo".
    const chaves = chavesEmProfundidade(cru)
    expect(chaves, 'o cenário de teste não tem `health_records` — ele não prova nada').toContain('health_records')
    expect(chaves).toContain('has_alert')
  })

  it('o filtro tira o sinal de saúde dos TRÊS lugares onde ele aparece', () => {
    /*
     * Três, e não um: `nextClient`, `alerts` e `restOfDay` carregam a mesma linha. Um `.map` que
     * esqueça qualquer um deles deixa o dado passar, e nenhuma varredura de fonte pegaria isso.
     */
    const limpo = semDadoDeSaude(cru)
    for (const proibido of ['has_alert']) {
      expect(
        chavesEmProfundidade(limpo),
        `\`${proibido}\` sobreviveu ao filtro e iria para o modelo junto com o nome da pessoa`,
      ).not.toContain(proibido)
    }
  })

  it('o resto do resumo continua inteiro — a guarda não esvazia a resposta', () => {
    // Filtro que apaga demais é tão defeito quanto filtro que apaga de menos: o modelo precisa do
    // nome, do horário e do serviço para redigir a frase.
    const limpo = semDadoDeSaude(cru)
    expect(limpo.revenueTodayCents).toBe(12_000)
    expect(limpo.nextClient?.clients?.name).toBe('Fulana')
    expect(limpo.alerts).toHaveLength(1)
    expect(limpo.restOfDay).toHaveLength(1)
    expect(limpo.restOfDay[0]?.services?.name).toBe('Corte')
  })

  it('a linha sem cliente não quebra o filtro', () => {
    const semCliente = { ...cru, nextClient: { ...linhaComAlerta('a4'), clients: null } } as unknown as ResumoHoje
    expect(() => semDadoDeSaude(semCliente)).not.toThrow()
  })
})

describe('nenhuma ferramenta do assistente escreve no banco', () => {
  const fonte = semComentarios(readFileSync(FONTE, 'utf8'))

  it('a leitura não voltou vazia', () => {
    expect(FERRAMENTAS.length, 'nenhuma ferramenta registrada').toBeGreaterThan(8)
    expect(fonte.length).toBeGreaterThan(3_000)
  })

  it('não há insert, update, upsert nem delete', () => {
    /*
     * A regra que faz o assistente PROPOR em vez de agir. As ferramentas `preparar_*` dizem, na
     * própria descrição, que não marcam nada — mas descrição é texto, e o modelo não a executa.
     * Quem garante é a ausência de escrita no código.
     */
    const escritas = [...fonte.matchAll(/\.(insert|update|upsert|delete)\s*\(/g)].map((m) => m[1])
    expect(
      escritas,
      'uma ferramenta do assistente escreve no banco. `docs/26` §2: "Escrita exige confirmação ' +
        'humana — o assistente devolve uma proposta; quem executa é o endpoint normal, com o ' +
        'clique do dono."',
    ).toEqual([])
  })

  it('nem chamada de RPC, que é escrita por outro nome', () => {
    expect(/\.rpc\s*\(/.test(fonte), 'uma ferramenta chama RPC — funções `security definer` escrevem').toBe(false)
  })

  it('o detector funciona — ele acharia uma escrita se houvesse', () => {
    // Guarda contra o próprio detector: sem isto, um padrão quebrado deixaria a lista sempre vazia.
    const falso = "await db.from('appointments').insert({ x: 1 })"
    expect([...falso.matchAll(/\.(insert|update|upsert|delete)\s*\(/g)].length).toBe(1)
  })
})
