import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { ritmoDeUso } from '@/core/cycle/relogios'
import { avaliarLeitura } from '@/core/manutencao/leitura-de-km'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('a leitura de km no check-in (AUT-103, C-029)', () => {
  const historico = [
    { date: d('2026-01-10'), km: 30_000 },
    { date: d('2026-05-10'), km: 34_800 },
  ]

  it('primeira leitura e leitura normal passam', () => {
    expect(avaliarLeitura([], { date: d('2026-01-10'), km: 30_000 })).toEqual({ tipo: 'primeira' })
    expect(avaliarLeitura(historico, { date: d('2026-10-14'), km: 41_300 })).toEqual({ tipo: 'ok' })
  })

  it('zero a mais vira "salto", com o aviso do zero', () => {
    const a = avaliarLeitura(historico, { date: d('2026-10-14'), km: 413_000 })
    expect(a.tipo).toBe('salto')
    expect(a.tipo === 'salto' && a.aviso).toContain('sobrou um zero')
  })

  it('km que desce vira "desce", com a diferença e a pergunta do painel', () => {
    const a = avaliarLeitura(historico, { date: d('2026-10-14'), km: 12_000 })
    expect(a).toMatchObject({ tipo: 'desce', diferencaKm: 22_800 })
    expect(a.tipo === 'desce' && a.aviso).toContain('Trocou o painel?')
  })

  it('compara com a última leitura ATÉ a data da nova, não com uma posterior', () => {
    expect(avaliarLeitura(historico, { date: d('2026-03-01'), km: 32_000 })).toEqual({ tipo: 'ok' })
  })
})

describe('o relógio de uso já se defende de uma leitura absurda (C-029, medido)', () => {
  it('com um zero a mais no meio, o ritmo do C-002 continua 36 km/dia — o aviso do balcão protege o histórico, não o relógio', () => {
    const leituras = [
      { date: d('2026-01-01'), uso: 30_000 },
      { date: d('2026-04-01'), uso: 33_240 },
      { date: d('2026-07-01'), uso: 365_000 }, // digitado com um zero a mais (36.500)
      { date: d('2026-10-01'), uso: 39_830 },
    ]
    expect(Math.round(ritmoDeUso(leituras, 36).porDia)).toBe(36)
  })
})
