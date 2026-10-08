import { describe, expect, it } from 'vitest'

import { EsquemaProdutoNovo } from '@/server/services/estoque'
import { EsquemaVendaDeProduto } from '@/server/services/venda-de-produto'

const PROFISSIONAL = '3f2b8d0e-5c1a-4c1e-9d0a-1a2b3c4d5e6f'

describe('EsquemaVendaDeProduto', () => {
  it('vende uma unidade no Pix quando só se diz quem vendeu', () => {
    expect(EsquemaVendaDeProduto.parse({ professionalId: PROFISSIONAL })).toEqual({ professionalId: PROFISSIONAL, qty: 1, paymentMethod: 'pix' })
  })

  it('recusa quantidade quebrada, zerada ou absurda, e venda sem vendedor', () => {
    expect(EsquemaVendaDeProduto.safeParse({ professionalId: PROFISSIONAL, qty: 1.5 }).success).toBe(false)
    expect(EsquemaVendaDeProduto.safeParse({ professionalId: PROFISSIONAL, qty: 0 }).success).toBe(false)
    expect(EsquemaVendaDeProduto.safeParse({ professionalId: PROFISSIONAL, qty: 1000 }).success).toBe(false)
    expect(EsquemaVendaDeProduto.safeParse({ qty: 1 }).success).toBe(false)
  })
})

describe('EsquemaProdutoNovo', () => {
  it('aceita estoque inicial e parte de zero sem ele', () => {
    const base = { name: 'Óleo de barba', isRetail: true, priceCents: 4_500 }
    expect(EsquemaProdutoNovo.parse({ ...base, initialQty: 6 }).initialQty).toBe(6)
    expect(EsquemaProdutoNovo.parse(base).initialQty).toBe(0)
  })

  it('segue exigindo preço para produto de revenda e recusa estoque negativo', () => {
    expect(EsquemaProdutoNovo.safeParse({ name: 'Óleo de barba', isRetail: true }).success).toBe(false)
    expect(EsquemaProdutoNovo.safeParse({ name: 'Óleo de barba', isRetail: true, priceCents: 100, initialQty: -1 }).success).toBe(false)
  })
})
