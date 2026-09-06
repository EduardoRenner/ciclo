import { readdirSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O catálogo de `vertical_packs` vive em JSONB, e JSONB não tem `check`.
 *
 * Isso cria uma assimetria que custou caro: um valor fora de faixa em `profession_services`
 * (tabela, com `check`) reprova a migration no CI na hora. O mesmo valor dentro do JSONB de um
 * pack passa batido pelo CI inteiro e só aparece quando alguém CRIA UMA CONTA de verdade daquela
 * vertical — onboarding com erro de constraint, no pior momento possível.
 *
 * ## O defeito que deu origem a esta guarda
 *
 * 8 dos 51 serviços semeados têm `cycle_days: 0`, que quer dizer "não tem retorno natural"
 * (orçamento, avaliação, tatuagem, penteado, remoção, retoque). A coluna exige `between 1 and
 * 365`, e a `0008` resolveu com `greatest(..., 1)`. Só que 1 não é a ausência de afirmação — é a
 * afirmação "volte amanhã". Medido no `computeCycle` com padrão 1: `late` em 2 dias, `at_risk` em
 * 14, `lost` em 35. Verticais inteiras (tattoo, hair) viviam na lista de "Chamar de volta",
 * inflando o número de dinheiro que sustenta o preço do produto.
 *
 * A 0063 troca o mapeamento para 21 — o `default` que a própria coluna escolheu para "não sei".
 */

const DIR = 'supabase/migrations'
const MIGRATIONS = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

/** Todo objeto JSON de serviço de pack, de qualquer migration que semeie catálogo. */
function servicosDePack(): { arquivo: string; servico: Record<string, unknown> }[] {
  const achados: { arquivo: string; servico: Record<string, unknown> }[] = []
  for (const arquivo of MIGRATIONS) {
    const sql = readFileSync(`${DIR}/${arquivo}`, 'utf8')
    for (const bruto of sql.match(/\{[^{}]*"duration_min"[^{}]*\}/g) ?? []) {
      achados.push({ arquivo, servico: JSON.parse(bruto) as Record<string, unknown> })
    }
  }
  return achados
}

/**
 * A versão VIGENTE de `apply_vertical_pack`: a última `create or replace` na ordem das
 * migrations. Resolver dinamicamente é o que impede esta guarda de vigiar uma versão morta
 * quando alguém escrever a próxima.
 */
function corpoVigenteDaFuncao(): { arquivo: string; corpo: string } {
  let vigente: { arquivo: string; corpo: string } | null = null
  for (const arquivo of MIGRATIONS) {
    const sql = readFileSync(`${DIR}/${arquivo}`, 'utf8')
    const i = sql.lastIndexOf('create or replace function public.apply_vertical_pack')
    if (i === -1) continue
    const fim = sql.indexOf('end $$;', i)
    vigente = { arquivo, corpo: sql.slice(i, fim === -1 ? undefined : fim) }
  }
  if (!vigente) throw new Error('não achei nenhuma definição de apply_vertical_pack')
  return vigente
}

const CHECKS_DE_SERVICES: [string, (v: number) => boolean, string][] = [
  ['duration_min', (v) => v >= 5 && v <= 720, 'between 5 and 720'],
  ['price_cents', (v) => v >= 0, '>= 0'],
  ['deposit_bps', (v) => v >= 0 && v <= 10000, 'between 0 and 10000'],
  ['buffer_after_min', (v) => v >= 0, '>= 0'],
]

describe('o pack não pode inventar ciclo nem estourar constraint', () => {
  it('acha os serviços de pack — piso, para "zero violações" não sair de uma varredura vazia', () => {
    // O piso é o positivo conhecido: 34 na 0002 e 17 na 0057. Se o parser cegar, isto grita.
    expect(servicosDePack().length).toBeGreaterThanOrEqual(51)
  })

  it('todo campo de pack cabe no `check` da tabela `services`', () => {
    /*
     * `cycle_days` fica FORA desta lista de propósito: 0 é legítimo no pack ("sem ciclo") e quem
     * traduz é a função. Os outros campos entram crus, e um valor fora de faixa neles derrubaria
     * o onboarding inteiro daquela vertical.
     */
    const fora: string[] = []
    for (const { arquivo, servico } of servicosDePack()) {
      for (const [campo, ok, faixa] of CHECKS_DE_SERVICES) {
        const v = servico[campo]
        if (v === undefined || v === null) continue
        if (typeof v !== 'number' || !ok(v)) fora.push(`${arquivo}: ${String(servico.name)} tem ${campo}=${String(v)} (exige ${faixa})`)
      }
    }
    expect(fora).toEqual([])
  })

  it('`cycle_days` de pack é inteiro de 0 a 365 — 0 quer dizer "sem ciclo"', () => {
    const fora = servicosDePack()
      .filter(({ servico }) => {
        const v = servico.cycle_days
        return v !== undefined && v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 365)
      })
      .map(({ servico }) => String(servico.name))
    expect(fora).toEqual([])
  })

  it('a função traduz "sem ciclo" para o padrão da coluna, nunca para 1', () => {
    /*
     * Esta é a metade que a varredura de dados não pega: os dados podem estar perfeitos e a
     * TRADUÇÃO continuar errada. `greatest(cycle_days, 1)` não estoura constraint nenhuma e mesmo
     * assim afirma "volte amanhã" para todo serviço sem ciclo.
     */
    const { corpo } = corpoVigenteDaFuncao()
    const trecho = corpo.slice(corpo.indexOf('insert into services'), corpo.indexOf('-- produtos'))

    expect(trecho).not.toContain('greatest((item->>\'cycle_days\')::int, 1)')
    expect(trecho).toContain('21')
  })
})
