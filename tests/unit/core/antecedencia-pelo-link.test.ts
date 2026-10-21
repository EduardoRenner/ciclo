import { describe, expect, it } from 'vitest'

import { diaAceitoPeloLink, primeiroDiaPeloLink } from '@/core/scheduling/antecedencia'

/**
 * docs/114 L-04: pelo link a cliente marca a partir de amanhã (padrão de 1 dia). "Hoje" é o dia do
 * calendário no fuso do salão, não 24 horas: às 18h, as 9h de amanhã já valem.
 */
describe('antecedência mínima em dias, pelo link', () => {
  it('com 1 dia (o padrão), o primeiro dia é amanhã', () => {
    expect(primeiroDiaPeloLink('2026-10-21', 1)).toBe('2026-10-22')
    expect(diaAceitoPeloLink('2026-10-21', '2026-10-21', 1)).toBe(false)
    expect(diaAceitoPeloLink('2026-10-22', '2026-10-21', 1)).toBe(true)
  })

  it('com 0, hoje vale (a profissional escolheu aceitar horário para hoje)', () => {
    expect(diaAceitoPeloLink('2026-10-21', '2026-10-21', 0)).toBe(true)
  })

  it('vira o mês e o ano', () => {
    expect(primeiroDiaPeloLink('2026-12-31', 1)).toBe('2027-01-01')
    expect(primeiroDiaPeloLink('2026-10-30', 3)).toBe('2026-11-02')
  })

  it('dia passado nunca vale', () => {
    expect(diaAceitoPeloLink('2026-10-20', '2026-10-21', 0)).toBe(false)
  })
})
