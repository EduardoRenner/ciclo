import { describe, expect, it } from 'vitest'

import { estimativaParaDuracao, formatarPreco } from '@/core/pricing/formatar'

// `Intl.NumberFormat('pt-BR', { style: 'currency' })` usa espaço não-quebrável (U+00A0 ou
// U+202F, depende da versão do ICU) entre "R$" e o número — visualmente idêntico a um espaço
// normal, mas `toBe('R$ 50,00')` com espaço comum falha. Formata pelo mesmo Intl pra comparar
// like-for-like, em vez de arriscar o caractere errado num literal.
const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const r = (cents: number) => dinheiro.format(cents / 100)

describe('formatarPreco', () => {
  it('fixed com preço mostra o valor direto', () => {
    expect(formatarPreco({ pricingModel: 'fixed', priceCents: 5000, hourlyRateCents: null, halfDayPriceCents: null })).toBe(r(5000))
  })

  it('fixed sem preço (orçamento à parte) mostra "Consultar"', () => {
    expect(formatarPreco({ pricingModel: 'fixed', priceCents: 0, hourlyRateCents: null, halfDayPriceCents: null })).toBe('Consultar')
  })

  it('hourly mostra o valor por hora', () => {
    expect(formatarPreco({ pricingModel: 'hourly', priceCents: 8000, hourlyRateCents: null, halfDayPriceCents: null })).toBe(`${r(8000)}/hora`)
  })

  it('visit_hourly mostra taxa de visita + valor da hora', () => {
    expect(formatarPreco({ pricingModel: 'visit_hourly', priceCents: 6000, hourlyRateCents: 5000, halfDayPriceCents: null })).toBe(
      `${r(6000)} (visita) + ${r(5000)}/hora`,
    )
  })

  it('daily sem meia diária mostra só a diária inteira', () => {
    expect(formatarPreco({ pricingModel: 'daily', priceCents: 20000, hourlyRateCents: null, halfDayPriceCents: null })).toBe(`${r(20000)} (diária)`)
  })

  it('daily com meia diária mostra as duas opções', () => {
    expect(formatarPreco({ pricingModel: 'daily', priceCents: 20000, hourlyRateCents: null, halfDayPriceCents: 12000 })).toBe(
      `${r(20000)} (diária) · ${r(12000)} (meia diária)`,
    )
  })

  it('visit_hourly sem taxa da hora (dado inconsistente) não quebra — cai pra R$ 0,00/hora', () => {
    // A constraint do banco impede isso, mas o `?? 0` do código é a rede; sem teste ninguém
    // sabe se ela funciona.
    expect(formatarPreco({ pricingModel: 'visit_hourly', priceCents: 6000, hourlyRateCents: null, halfDayPriceCents: null })).toBe(
      `${r(6000)} (visita) + ${r(0)}/hora`,
    )
  })
})

describe('estimativaParaDuracao', () => {
  it('fixed ignora a duração — sempre o mesmo total', () => {
    expect(estimativaParaDuracao({ pricingModel: 'fixed', priceCents: 5000, hourlyRateCents: null, halfDayPriceCents: null }, 999)).toBe(5000)
  })

  it('hourly multiplica pela duração, arredondando pra cima', () => {
    expect(estimativaParaDuracao({ pricingModel: 'hourly', priceCents: 6000, hourlyRateCents: null, halfDayPriceCents: null }, 90)).toBe(9000) // 1.5h × 6000
    // 61min de uma taxa que não divide certo por 60 — nunca corta centavo do cliente.
    expect(estimativaParaDuracao({ pricingModel: 'hourly', priceCents: 6001, hourlyRateCents: null, halfDayPriceCents: null }, 61)).toBe(6102)
  })

  it('visit_hourly soma a taxa de visita à hora estimada', () => {
    expect(estimativaParaDuracao({ pricingModel: 'visit_hourly', priceCents: 8000, hourlyRateCents: 4000, halfDayPriceCents: null }, 60)).toBe(12000)
  })

  it('visit_hourly sem taxa da hora estima só a visita', () => {
    expect(estimativaParaDuracao({ pricingModel: 'visit_hourly', priceCents: 8000, hourlyRateCents: null, halfDayPriceCents: null }, 120)).toBe(8000)
  })

  it('daily ignora a duração — a diária é a diária', () => {
    expect(estimativaParaDuracao({ pricingModel: 'daily', priceCents: 20000, hourlyRateCents: null, halfDayPriceCents: 12000 }, 480)).toBe(20000)
  })
})
