import { describe, expect, it } from 'vitest'

import { backtest, previsorDoMotor, type Previsor } from '@/core/cycle/backtest'

import { CENARIOS, CENARIOS_CURTOS, CENARIOS_DE_UM_INTERVALO, gerar } from './cenarios'

/**
 * C-033: o TETO de cada cenário. O oráculo conhece o processo que gerou os dados e prevê o ponto que
 * maximiza a chance de acertar a semana (±7 d) do PRÓXIMO intervalo: a média da normal; no pulo, os 21 d
 * (80% das voltas; nenhum ponto cobre 21 e 42 ao mesmo tempo); no errático e no sumiço, o meio do
 * uniforme. Nenhum previsor feito só do passado passa dele, em média. A distância entre o Motor e o teto
 * é o mapa de onde vale investir; onde ela é zero, mexer no Motor é perda de tempo.
 */
const ORACULO: Record<string, (i: number) => number> = {
  'regular (21±2)': () => 21,
  'deriva (21 → 35)': (i) => 21 + 2 * i,
  'pulo (21, às vezes 42)': () => 21,
  'errático (14–45)': () => 29.5,
  'padrão errado (70±5, padrão 21)': () => 70,
  'ritmo curto (7±1, padrão 21)': () => 7,
  'sessões iniciais (2× 5±1, depois 21±2)': (i) => (i < 2 ? 5 : 21),
  'sumiço no início (1º intervalo 90–150, depois 21±2)': (i) => (i === 0 ? 120 : 21),
}

const oraculo = (nome: string): Previsor => (passado) => passado[passado.length - 1]!.add({ days: Math.round(ORACULO[nome]!(passado.length - 1)) })

const TODOS = [...CENARIOS, ...CENARIOS_CURTOS, ...CENARIOS_DE_UM_INTERVALO]

describe('o teto de cada cenário: quanto ainda dá para ganhar (C-033)', () => {
  const linhas = TODOS.map((c) => {
    const motor = backtest(gerar(c), previsorDoMotor).porFaixa['3+ visitas']!
    const teto = backtest(gerar(c), oraculo(c.nome)).porFaixa['3+ visitas']!
    return {
      cenario: c.nome,
      'Motor (3+) %': Math.round(motor.acertoNaSemanaPct),
      'teto (3+) %': Math.round(teto.acertoNaSemanaPct),
      'espaço (pontos)': Math.round(teto.acertoNaSemanaPct) - Math.round(motor.acertoNaSemanaPct),
    }
  })

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas).toHaveLength(TODOS.length)
  })

  it('o oráculo é teto de verdade: o Motor nunca passa dele (com 1 ponto de folga de amostra)', () => {
    for (const l of linhas) expect(l['Motor (3+) %'], l.cenario).toBeLessThanOrEqual(l['teto (3+) %'] + 1)
  })
})
