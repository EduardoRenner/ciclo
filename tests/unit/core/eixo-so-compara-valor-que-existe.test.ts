import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CONDICAO_DE_EIXO_PARA_GUARDA } from '@/core/billing/planos'

/**
 * `CONDICAO_DE_EIXO` esconde módulo da interface comparando o eixo do tenant com uma lista de
 * valores. Se um desses valores não existir no `check` da coluna, a comparação nunca dá verdadeira
 * — e o módulo some para exatamente quem deveria vê-lo.
 *
 * Não é hipótese: `quotes` comparava `inicio === 'orcamento'` desde a migration 0023, e
 * `'orcamento'` é valor de `cobranca`, não de `inicio`. Quem começa por orçamento era quem perdia o
 * módulo Orçamento. Passou despercebido porque os dois únicos tenants com eixo preenchido em
 * produção são `direto`, para quem esconder orçamento parece certo — o defeito só apareceria no
 * primeiro tenant de uma profissão que começa por orçamento.
 *
 * Por que a comparação virou lista em vez de closure: `satisfaz: (v) => v === 'orcamento'` não é
 * inspecionável. Nenhum teste consegue perguntar a uma função quais valores ela aceita sem
 * enumerar o universo. Uma lista responde essa pergunta direto — e é a única razão desta guarda
 * conseguir existir.
 */

const SQL = readFileSync('supabase/migrations/0023_tenant_eixos.sql', 'utf8')

/**
 * Lê `check (inicio in ('direto','solicitacao','orcamento_antes'))` de cada `add column`.
 *
 * Casa com o `check` e não com o nome da coluna solto: o nome do eixo aparece também no `update`
 * de backfill no fim da migration, e casar com ele traria o eixo sem os valores — a guarda passaria
 * comparando contra conjunto vazio, que é o modo silencioso de falhar que este projeto já viu
 * quatro vezes.
 */
function valoresAceitosPorEixo(): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>()
  for (const m of SQL.matchAll(/check \((\w+) in \(([^)]+)\)\)/g)) {
    const eixo = m[1] as string
    const valores = [...(m[2] as string).matchAll(/'([a-z_]+)'/g)].map((v) => v[1] as string)
    mapa.set(eixo, new Set(valores))
  }
  return mapa
}

describe('condição de eixo só compara com valor que a coluna aceita', () => {
  it('o leitor enxerga a migration — senão a guarda passa vazia', () => {
    const mapa = valoresAceitosPorEixo()
    // Os quatro eixos da 0023. Se a regex parar de casar, isto grita em vez de aprovar tudo.
    expect([...mapa.keys()].sort()).toEqual(['cobranca', 'inicio', 'onde', 'ritmo'])
    expect(mapa.get('inicio')).toEqual(new Set(['direto', 'solicitacao', 'orcamento_antes']))
  })

  it('há condição de eixo declarada para conferir', () => {
    // Guarda contra o próprio detector: se `CONDICAO_DE_EIXO` esvaziar num refactor, o teste
    // abaixo passaria sem conferir nada.
    expect(Object.keys(CONDICAO_DE_EIXO_PARA_GUARDA).length).toBeGreaterThanOrEqual(3)
  })

  it('nenhum módulo compara com valor impossível', () => {
    const aceitos = valoresAceitosPorEixo()

    const impossiveis: string[] = []
    for (const [modulo, condicao] of Object.entries(CONDICAO_DE_EIXO_PARA_GUARDA)) {
      const doEixo = aceitos.get(condicao.eixo)
      if (!doEixo) {
        impossiveis.push(`${modulo}: o eixo "${condicao.eixo}" não existe na migration 0023`)
        continue
      }
      for (const valor of condicao.valores) {
        if (!doEixo.has(valor)) {
          impossiveis.push(
            `${modulo}: compara ${condicao.eixo} === "${valor}", mas a coluna só aceita ${[...doEixo].join(' | ')}`,
          )
        }
      }
    }

    expect(
      impossiveis,
      'Comparação que nunca dá verdadeira: o módulo some da interface justamente para quem deveria vê-lo.',
    ).toEqual([])
  })

  it('todo módulo condicionado declara pelo menos um valor', () => {
    // Lista vazia esconderia o módulo de TODO tenant com o eixo preenchido — o mesmo estrago do
    // valor impossível, por um caminho que a checagem acima não pega.
    for (const [modulo, condicao] of Object.entries(CONDICAO_DE_EIXO_PARA_GUARDA)) {
      expect(condicao.valores.length, `${modulo} não aceita valor nenhum`).toBeGreaterThan(0)
    }
  })
})
