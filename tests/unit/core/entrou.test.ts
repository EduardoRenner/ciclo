import { describe, expect, it } from 'vitest'

import { entradasDoEntrou, entrouCents, numeroDoDia } from '@/core/caixa/entrou'

describe('entrouCents (APR-036a)', () => {
  it('soma o total das comandas fechadas e pagas, com desconto e gorjeta já dentro do total', () => {
    expect(entrouCents([{ status: 'closed', totalCents: 9_500 }, { status: 'paid', totalCents: 4_000 }])).toBe(13_500)
  })

  it('comanda aberta e estornada não entram: o estorno muda o número', () => {
    expect(entrouCents([{ status: 'open', totalCents: 9_500 }, { status: 'canceled', totalCents: 9_500 }])).toBe(0)
  })
})

describe('venda de pacote no Entrou (APR-016b)', () => {
  it('pacote de R$ 320 e 4 comandas de sessão pagas com o pacote: entrou R$ 320, não R$ 640', () => {
    const sessoes = Array.from({ length: 4 }, () => ({ status: 'closed', totalCents: 8_000, paymentMethod: 'package' }))
    expect(entrouCents(sessoes, [{ status: 'paid', amountCents: 32_000 }])).toBe(32_000)
  })

  it('venda desfeita sai; venda pendente não é dinheiro ainda', () => {
    expect(entrouCents([], [{ status: 'refunded', amountCents: 32_000 }, { status: 'pending', amountCents: 10_000 }])).toBe(0)
  })

  it('comanda paga em dinheiro continua entrando ao lado da venda', () => {
    expect(entrouCents([{ status: 'closed', totalCents: 5_000, paymentMethod: 'pix' }], [{ status: 'paid', amountCents: 32_000 }])).toBe(37_000)
  })

  it('a lista traz o instante de cada entrada, para agrupar por dia sem segunda regra', () => {
    expect(
      entradasDoEntrou(
        [{ status: 'closed', totalCents: 5_000, closedAt: '2026-10-13T13:00:00Z' }, { status: 'closed', totalCents: 8_000, paymentMethod: 'package', closedAt: '2026-10-13T14:00:00Z' }],
        [{ status: 'paid', amountCents: 32_000, paidAt: '2026-10-13T15:00:00Z' }],
      ),
    ).toEqual([
      { cents: 5_000, em: '2026-10-13T13:00:00Z' },
      { cents: 32_000, em: '2026-10-13T15:00:00Z' },
    ])
  })
})

describe('numeroDoDia', () => {
  it('quem usa comanda vê "Entrou hoje"; quem não usa, "Atendido hoje"', () => {
    expect(numeroDoDia({ usaComanda: true, entrouHojeCents: 9_500, atendidoHojeCents: 10_000 })).toEqual({ rotulo: 'Entrou hoje', cents: 9_500 })
    expect(numeroDoDia({ usaComanda: false, entrouHojeCents: 0, atendidoHojeCents: 10_000 })).toEqual({ rotulo: 'Atendido hoje', cents: 10_000 })
  })
})
