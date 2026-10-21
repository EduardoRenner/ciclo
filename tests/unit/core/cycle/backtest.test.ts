import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { backtest, metricas, previsorPadraoDoServico, type Previsor } from '@/core/cycle/backtest'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('backtest com origem móvel (C-001, MOT-001)', () => {
  it('uma previsão por prefixo, com o erro em dias contra a próxima visita real', () => {
    // padrão 21; visitas em 1/1, 22/1 (21 depois), 15/2 (24 depois)
    const r = backtest([{ datas: [d('2026-01-01'), d('2026-01-22'), d('2026-02-15')], padraoDoServico: 21 }], previsorPadraoDoServico)
    expect(r.geral.previsoes).toBe(2)
    // prefixo 1: prevê 22/1, real 22/1 → 0; prefixo 2: prevê 12/2, real 15/2 → −3 (cedo)
    expect(r.geral.viesDias).toBe(-1.5)
    expect(r.geral.erroMedianoDias).toBe(1.5)
    expect(r.porFaixa['1 visita']?.previsoes).toBe(1)
    expect(r.porFaixa['2 visitas']?.previsoes).toBe(1)
  })

  it('o previsor não enxerga o futuro: só recebe as visitas anteriores à que vai prever', () => {
    const vistos: number[] = []
    const espiao: Previsor = (passado) => {
      vistos.push(passado.length)
      return passado[passado.length - 1]!
    }
    backtest([{ datas: [d('2026-01-01'), d('2026-01-10'), d('2026-01-20'), d('2026-02-01')], padraoDoServico: 21 }], espiao)
    expect(vistos).toEqual([1, 2, 3])
  })

  it('métricas: acerto na semana usa a mesma tolerância da prestação de contas (±7)', () => {
    const m = metricas([0, 7, -7, 8, -30])
    expect(m.acertoNaSemanaPct).toBe(60)
    expect(m.erroMedianoDias).toBe(7)
  })

  it('histórico de uma visita só não gera previsão (não há o que conferir)', () => {
    expect(backtest([{ datas: [d('2026-01-01')], padraoDoServico: 21 }], previsorPadraoDoServico).geral.previsoes).toBe(0)
  })
})
