import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios, sqlSemComentarios } from '../../helpers/fonte'

/**
 * A inviolavel nº 11 do `CLAUDE.md`: **"Nunca delete agendamento, movimento de estoque ou registro
 * de auditoria. Use estado/compensação."** A tabela de armadilhas repete com outras palavras:
 * "Deletar o movimento de estoque no estorno → Gere movimento compensatório do tipo `return`".
 *
 * A regra estava cumprida no codigo — nenhuma linha do app chama `.delete()` nessas tabelas — e
 * **desmentida pelo schema**. `stock_moves.product_id` nasceu `on delete cascade` na `0001`:
 * apagar UM produto apagava o razao inteiro dele, sem `.delete()` nenhum, sem linha em `audit_log`,
 * e sem deixar o movimento compensatorio que a regra manda usar. Medido em producao em 2026-09-09:
 * `authenticated` tem DELETE em `products` e a politica `products_delete` libera `owner`/`manager`,
 * entao dono ou gerente fazia isso falando direto com o PostgREST. A `0079` trocou por `no action`.
 *
 * ## Por que a guarda olha para a FRENTE, e nao para a base inteira
 *
 * Migration e historico: a `0001` continua dizendo `on delete cascade` e sempre vai dizer — nao se
 * edita o passado, se corrige com uma nova. Uma guarda que varresse o corpus inteiro reprovaria a
 * `0001` para sempre e teria que ganhar uma excecao no primeiro dia, que e como excecao vira
 * deposito. Entao a regra e sobre o que ENTRA: nenhuma migration a partir da `0079` pode ligar
 * `on delete cascade` nas tabelas de historico.
 *
 * `tenants` e a excecao escrita: o offboarding de um tenant leva tudo dele junto, por desenho, e e
 * a unica porta em que isso e o comportamento certo.
 */
const DIR = 'supabase/migrations'

/** As tabelas que a regra nº 11 protege. `stock_moves` — e nao `stock_movements`, que nao existe. */
const HISTORICO = ['appointments', 'stock_moves', 'audit_log', 'vault_access_log']

/**
 * O nome da tabela errado e a forma mais barata de uma guarda passar verde sem olhar nada, e ela
 * quase aconteceu aqui: a primeira varredura desta investigacao procurou `stock_movements` — nome
 * plausivel, inexistente — e devolveu "nenhum delete encontrado", que e a mesma resposta que o
 * cenario limpo daria. O piso abaixo existe por causa disso.
 */
const ONDE_A_TABELA_APARECE = "from('"

const A_PARTIR_DE = '0079'

function migrations(): { nome: string; sql: string }[] {
  return readdirSync(DIR)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((nome) => ({ nome, sql: sqlSemComentarios(readFileSync(join(DIR, nome), 'utf8')).toLowerCase() }))
}

function fontes(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...fontes(caminho))
    else if (/[.]tsx?$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const FONTES = fontes('src').map((f) => f.split(String.fromCharCode(92)).join('/'))

/**
 * De qual tabela cada `.delete()` do fonte apaga.
 *
 * Anda para TRAS ate o `.from(` mais proximo em vez de olhar uma janela de N caracteres para a
 * frente. Numa cadeia do supabase-js o `.from()` sempre vem antes do `.delete()`, e a cadeia se
 * quebra em varias linhas quando ha filtros — janela por contagem de caracteres e a armadilha nº 4
 * da tabela do CLAUDE.md, e aqui ela erraria nos dois sentidos: curta demais perde o `.from()` de
 * uma cadeia com tres `.eq()`, longa demais captura o `.from()` da consulta de cima.
 */
function tabelasComDelete(fonte: string): string[] {
  const tabelas: string[] = []
  const codigo = semComentarios(fonte)
  let i = codigo.indexOf('.delete()')
  while (i !== -1) {
    const antes = codigo.slice(0, i)
    const j = antes.lastIndexOf(ONDE_A_TABELA_APARECE)
    if (j !== -1) {
      const nome = antes.slice(j + ONDE_A_TABELA_APARECE.length).split("'")[0]
      if (nome) tabelas.push(nome)
    }
    i = codigo.indexOf('.delete()', i + 1)
  }
  return tabelas
}

const DELETADAS = new Map<string, string[]>(
  FONTES.map((f) => [f, tabelasComDelete(readFileSync(f, 'utf8'))]).filter(([, t]) => (t as string[]).length > 0) as [
    string,
    string[],
  ][],
)

describe('o leitor deste teste', () => {
  it('acha os deletes que EXISTEM — não passa por não ter encontrado nada', () => {
    /*
     * Controle positivo, e ele e o coracao do piso. Estes dois deletes sao legitimos e conhecidos:
     * `idempotency_keys` solta a reserva quando a operacao falha (senao a chave fica presa para
     * sempre e a fila offline nunca mais repete), e `tenants` e o rollback do cadastro em
     * `onboarding.ts`. Se o extrator quebrar, os dois somem da conta — e a asserção de baixo, que
     * afirma AUSENCIA, passaria vazia sem ninguem ver.
     */
    const todas = [...DELETADAS.values()].flat()
    expect(todas, 'o extrator não achou o delete de `idempotency_keys`').toContain('idempotency_keys')
    expect(todas, 'o extrator não achou o delete de `tenants`').toContain('tenants')
    expect(FONTES.length).toBeGreaterThan(300)
  })

  it('as tabelas protegidas existem no fonte com o nome que a guarda usa', () => {
    // `stock_movements` (inexistente) daria a mesma resposta que "está tudo limpo". O nome tem que
    // ser provado, não suposto.
    const tudo = FONTES.map((f) => readFileSync(f, 'utf8')).join('\n')
    for (const tabela of HISTORICO) {
      expect(tudo.includes(`${ONDE_A_TABELA_APARECE}${tabela}'`), `nenhum código fala com \`${tabela}\``).toBe(true)
    }
  })

  it('achou as migrations', () => {
    expect(migrations().length).toBeGreaterThan(70)
  })
})

describe('nada apaga histórico: nem o código, nem o schema', () => {
  it('nenhum `.delete()` do app cai numa tabela de histórico', () => {
    const proibidos: string[] = []
    for (const [arquivo, tabelas] of DELETADAS) {
      for (const t of tabelas) if (HISTORICO.includes(t)) proibidos.push(`${arquivo} → ${t}`)
    }
    expect(
      proibidos,
      'a inviolável nº 11: agendamento, movimento de estoque e registro de auditoria nunca são ' +
        'apagados. Use estado (cancelamento) ou compensação (movimento `return`).',
    ).toEqual([])
  })

  /*
    A contagem e por ARQUIVO, nao por constraint, e isso e grosseiro de proposito. Uma migration
    que mencione `appointments` E ligue um cascade em outra tabela qualquer no mesmo arquivo
    reprova aqui sem ter o defeito — falso positivo assumido, e o custo dele e uma leitura.

    O outro lado da moeda seria escrever um parser de `create table` para amarrar cada cascade a
    sua tabela, e ai o erro passa a ser do parser: bloco que ele nao fecha direito vira defeito
    que nao se ve. Para uma regra sobre perda IRREVERSIVEL, errar avisando demais e melhor que
    errar calando, e a mensagem diz exatamente o que fazer. Migrations desta base sao pequenas e
    focadas, entao na pratica o falso positivo e raro.
  */
  it('nenhuma migration nova liga `on delete cascade` numa tabela de histórico', () => {
    const achados: string[] = []
    for (const { nome, sql } of migrations()) {
      if (nome.slice(0, 4) < A_PARTIR_DE) continue
      for (const tabela of HISTORICO) {
        if (!sql.includes(tabela)) continue
        // `tenants` é a porta escrita: o offboarding leva tudo do tenant junto, por desenho.
        const cascatas = sql.split('on delete cascade').length - 1
        const doTenant = sql.split('references public.tenants').length - 1 + (sql.split('references tenants').length - 1)
        if (cascatas > doTenant) achados.push(`${nome} (${tabela})`)
      }
    }
    expect(
      [...new Set(achados)],
      'migration nova ligando `on delete cascade` numa tabela de histórico. Apagar o pai apagaria ' +
        'o histórico sem `.delete()`, sem audit_log e sem compensação — foi o que a 0079 desfez. ' +
        'Use `on delete no action` (não `restrict`: ele quebra o cascade de offboarding do tenant).',
    ).toEqual([])
  })

  it('a 0079 continua desfazendo o cascade do razão de estoque', () => {
    const zero79 = migrations().find((m) => m.nome.startsWith(A_PARTIR_DE))
    expect(zero79, 'a 0079 sumiu — as afirmações acima passariam sobre outra base').toBeDefined()
    expect(zero79?.sql).toContain('stock_moves_product_id_fkey')
    expect(zero79?.sql).toContain('on delete no action')
    expect(zero79?.sql.includes('on delete cascade'), 'a 0079 é justamente quem tira o cascade').toBe(false)
  })
})
