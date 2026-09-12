import { describe, expect, it } from 'vitest'

import { receitaContratadaCents } from '@/core/loyalty/receita-contratada'

describe('receitaContratadaCents', () => {
  it('sem assinaturas ativas, zero', () => {
    expect(receitaContratadaCents([])).toBe(0)
  })

  it('soma o preço de cada assinatura ativa', () => {
    expect(receitaContratadaCents([{ priceCents: 5000 }, { priceCents: 9900 }, { priceCents: 3000 }])).toBe(17900)
  })
})
