import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { computeCycle } from '@/core/cycle/compute'
import { preverPorRelogios, ritmoDeUso } from '@/core/cycle/relogios'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('relógio múltiplo (C-002)', () => {
  it('invariante: só o relógio de tempo (beleza) dá exatamente o computeCycle', () => {
    const visitas = ['2026-01-01', '2026-01-22', '2026-02-12', '2026-03-06'].map((x) => ({ date: d(x) }))
    const motor = computeCycle({ history: visitas, defaultCycleDays: 21, today: d('2026-03-06') }).predictedDate
    const r = preverPorRelogios(visitas, { dias: 21 }, 0)
    expect(r.data.equals(motor)).toBe(true)
    expect(r.relogio).toBe('tempo')
  })

  it('o ritmo de uso é a mediana entre leituras, e uma leitura errada (que desce) é ignorada', () => {
    const r = ritmoDeUso(
      [
        { date: d('2026-01-01'), uso: 10_000 },
        { date: d('2026-02-01'), uso: 11_240 }, // 40/dia
        { date: d('2026-03-01'), uso: 1_200 }, // digitado errado: desce → ignorado
        { date: d('2026-04-01'), uso: 13_720 },
      ],
      36,
    )
    expect(r.origem).toBe('medido')
    expect(r.porDia).toBeGreaterThan(35)
    expect(r.porDia).toBeLessThan(45)
  })

  it('com uma leitura só, usa o ritmo de referência e diz que usou', () => {
    expect(ritmoDeUso([{ date: d('2026-01-01'), uso: 5_000 }], 36)).toEqual({ porDia: 36, origem: 'referencia', leituras: 1 })
  })

  it('o que vencer primeiro: motorista de aplicativo (140 km/dia) vence pela quilometragem, não pelos 12 meses', () => {
    const visitas = [
      { date: d('2026-01-01'), uso: 20_000 },
      { date: d('2026-03-12'), uso: 29_800 }, // 70 dias, 9.800 km = 140/dia
    ]
    const r = preverPorRelogios(visitas, { dias: 365, uso: 10_000, tempoPeloRitmo: false }, 36)
    expect(r.relogio).toBe('uso')
    expect(r.data.equals(d('2026-03-12').add({ days: 71 }))).toBe(true) // 10.000 / 140 ≈ 71
    expect(r.porTempo?.equals(d('2027-03-12'))).toBe(true)
  })

  it('carro que roda pouco vence pelo tempo (o óleo envelhece parado)', () => {
    const visitas = [
      { date: d('2025-01-01'), uso: 30_000 },
      { date: d('2026-01-01'), uso: 33_650 }, // 10/dia
    ]
    expect(preverPorRelogios(visitas, { dias: 365, uso: 10_000, tempoPeloRitmo: false }, 36).relogio).toBe('tempo')
  })
})
