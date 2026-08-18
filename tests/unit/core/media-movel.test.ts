import { describe, expect, it } from 'vitest'

import { calcularNovoCustoMedio } from '@/core/estoque/media-movel'

describe('calcularNovoCustoMedio', () => {
  it('estoque zerado: o novo custo médio é o custo da entrada', () => {
    const r = calcularNovoCustoMedio({ estoqueAtualQty: 0, custoMedioAtualCents: 0, qtyEntrada: 10, custoUnitarioEntradaCents: 500 })
    expect(r).toBe(500)
  })

  it('mistura proporcional: 10un a R$5 + 10un a R$7 dá R$6 de média', () => {
    const r = calcularNovoCustoMedio({ estoqueAtualQty: 10, custoMedioAtualCents: 500, qtyEntrada: 10, custoUnitarioEntradaCents: 700 })
    expect(r).toBe(600)
  })

  it('entrada muito maior que o estoque puxa a média pra perto do custo novo', () => {
    const r = calcularNovoCustoMedio({ estoqueAtualQty: 1, custoMedioAtualCents: 100, qtyEntrada: 99, custoUnitarioEntradaCents: 1_000 })
    expect(r).toBe(991) // (1*100 + 99*1000) / 100 = 991
  })

  it('estoque final zero ou negativo (ajuste pra baixo) não divide por zero — cai pro custo da entrada', () => {
    const r = calcularNovoCustoMedio({ estoqueAtualQty: 5, custoMedioAtualCents: 300, qtyEntrada: -5, custoUnitarioEntradaCents: 300 })
    expect(r).toBe(300)
  })
})
