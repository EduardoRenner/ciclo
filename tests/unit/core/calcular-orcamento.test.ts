import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { orcamentoExpirado, totalDoItem, totalDoOrcamento } from '@/core/orcamento/calcular'

const TZ = 'America/Sao_Paulo'

describe('totalDoItem / totalDoOrcamento', () => {
  it('multiplica qty por preço unitário', () => {
    expect(totalDoItem({ qty: 3, unitPriceCents: 5000 })).toBe(15000)
  })

  it('arredonda pra cima quando qty é decimal (ex.: meia diária)', () => {
    expect(totalDoItem({ qty: 0.5, unitPriceCents: 2001 })).toBe(1001) // 1000.5 → 1001, nunca corta centavo do cliente
  })

  it('soma todos os itens do orçamento', () => {
    const total = totalDoOrcamento([
      { qty: 1, unitPriceCents: 10000 },
      { qty: 2, unitPriceCents: 5000 },
    ])
    expect(total).toBe(20000)
  })

  it('orçamento sem itens soma zero', () => {
    expect(totalDoOrcamento([])).toBe(0)
  })
})

describe('orcamentoExpirado', () => {
  it('sem validade definida, nunca expira', () => {
    expect(orcamentoExpirado(null, TZ, Temporal.Instant.from('2027-01-01T00:00:00Z'))).toBe(false)
  })

  it('ainda dentro do dia de validade (fuso do tenant) não expirou', () => {
    // 2026-08-25 23:00 em São Paulo (UTC-3) ainda é dia 25 lá, mesmo já sendo dia 26 em UTC.
    const agora = Temporal.Instant.from('2026-08-26T02:00:00Z')
    expect(orcamentoExpirado('2026-08-25', TZ, agora)).toBe(false)
  })

  it('depois da meia-noite do dia seguinte (fuso do tenant) expirou', () => {
    const agora = Temporal.Instant.from('2026-08-26T03:00:00Z') // 00:00 em SP
    expect(orcamentoExpirado('2026-08-25', TZ, agora)).toBe(true)
  })
})
