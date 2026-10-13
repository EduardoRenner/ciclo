import { describe, expect, it } from 'vitest'

import { entrouCents, numeroDoDia } from '@/core/caixa/entrou'

describe('entrouCents (APR-036a)', () => {
  it('soma o total das comandas fechadas e pagas, com desconto e gorjeta já dentro do total', () => {
    expect(entrouCents([{ status: 'closed', totalCents: 9_500 }, { status: 'paid', totalCents: 4_000 }])).toBe(13_500)
  })

  it('comanda aberta e estornada não entram: o estorno muda o número', () => {
    expect(entrouCents([{ status: 'open', totalCents: 9_500 }, { status: 'canceled', totalCents: 9_500 }])).toBe(0)
  })
})

describe('numeroDoDia', () => {
  it('quem usa comanda vê "Entrou hoje"; quem não usa, "Atendido hoje"', () => {
    expect(numeroDoDia({ usaComanda: true, entrouHojeCents: 9_500, atendidoHojeCents: 10_000 })).toEqual({ rotulo: 'Entrou hoje', cents: 9_500 })
    expect(numeroDoDia({ usaComanda: false, entrouHojeCents: 0, atendidoHojeCents: 10_000 })).toEqual({ rotulo: 'Atendido hoje', cents: 10_000 })
  })
})
