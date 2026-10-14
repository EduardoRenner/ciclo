import { describe, expect, it } from 'vitest'

import { PREVISORES_DE_BASE, backtest, previsorDoMotor, type Previsor, type ResultadoDoBacktest } from '@/core/cycle/backtest'

import { CENARIOS, gerar } from './cenarios'

export function placar(previsores: Record<string, Previsor>): Record<string, Record<string, ResultadoDoBacktest>> {
  return Object.fromEntries(CENARIOS.map((c) => [c.nome, Object.fromEntries(Object.entries(previsores).map(([n, p]) => [n, backtest(gerar(c), p)]))]))
}

describe('o Motor nos cinco cenários (C-001)', () => {
  const tabela = placar({ 'Motor v-atual': previsorDoMotor, ...PREVISORES_DE_BASE })

  it('imprime o placar (erro mediano em dias · acerto na semana) para o registro do ciclo', () => {
    const linhas = Object.entries(tabela).flatMap(([cenario, porPrevisor]) =>
      Object.entries(porPrevisor).map(([previsor, r]) => ({
        cenario,
        previsor,
        'erro mediano (3+)': r.porFaixa['3+ visitas']?.erroMedianoDias,
        'acerto ±7 (3+) %': Math.round(r.porFaixa['3+ visitas']?.acertoNaSemanaPct ?? 0),
        'erro mediano (geral)': r.geral.erroMedianoDias,
        'viés (geral)': Math.round(r.geral.viesDias * 10) / 10,
      })),
    )
    console.table(linhas)
    expect(linhas.length).toBe(CENARIOS.length * 5)
  })

  it('o Motor ganha da régua fixa do serviço onde o cliente tem ritmo próprio (regular com deriva)', () => {
    const deriva = tabela['deriva (21 → 35)']!
    expect(deriva['Motor v-atual']!.porFaixa['3+ visitas']!.erroMedianoDias).toBeLessThan(deriva['padrão do serviço']!.porFaixa['3+ visitas']!.erroMedianoDias)
  })
})

/**
 * Guarda MOT-003: a versão do Motor no ar não pode piorar NENHUM cenário em relação à anterior.
 * O piso é a versão anterior medida neste arquivo (v1 em C-001; v3 em C-006; v4 em C-011, `docs/105-ciclo/`). Mudou o Motor? Rode o placar, e só baixe um número desta tabela com
 * melhora medida — nunca suba.
 */
const PISO_ERRO_MEDIANO_3MAIS: Record<string, number> = {
  'regular (21±2)': 1,
  'deriva (21 → 35)': 4,
  'pulo (21, às vezes 42)': 3,
  'errático (14–45)': 8,
  'padrão errado (70±5, padrão 21)': 4,
}
const PISO_ACERTO_3MAIS_PCT: Record<string, number> = {
  'regular (21±2)': 100,
  'deriva (21 → 35)': 92,
  'pulo (21, às vezes 42)': 74,
  'errático (14–45)': 47,
  'padrão errado (70±5, padrão 21)': 79,
}

describe('nenhuma versão do Motor piora um cenário (C-001, MOT-003)', () => {
  const atual = placar({ Motor: previsorDoMotor })
  it.each(CENARIOS.map((c) => c.nome))('%s: erro mediano e acerto na semana iguais ou melhores que a versão anterior', (nome) => {
    const r = atual[nome]!['Motor']!.porFaixa['3+ visitas']!
    expect(r.erroMedianoDias).toBeLessThanOrEqual(PISO_ERRO_MEDIANO_3MAIS[nome]!)
    expect(Math.round(r.acertoNaSemanaPct)).toBeGreaterThanOrEqual(PISO_ACERTO_3MAIS_PCT[nome]!)
  })

  it('v2: o cliente de ritmo longo num serviço de padrão errado deixa de ser previsto pelo padrão', () => {
    const r = atual['padrão errado (70±5, padrão 21)']!['Motor']!.porFaixa['3+ visitas']!
    expect(r.erroMedianoDias).toBeLessThan(10)
    expect(r.acertoNaSemanaPct).toBeGreaterThan(50)
  })
})
