import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { calcularDiasDeCobertura, estadoValidade, precisaRecomprar } from '@/core/estoque/alertas'

describe('calcularDiasDeCobertura', () => {
  it('estoque 30, consumo 3/dia: 10 dias de cobertura', () => {
    expect(calcularDiasDeCobertura(30, 3)).toBe(10)
  })

  it('sem consumo (0/dia): null, não infinito nem erro', () => {
    expect(calcularDiasDeCobertura(30, 0)).toBeNull()
  })
})

describe('precisaRecomprar', () => {
  it('estoque abaixo do ponto de pedido, mesmo com cobertura folgada, alerta', () => {
    expect(precisaRecomprar({ estoqueAtualQty: 5, reorderPointQty: 10, diasDeCobertura: 60 })).toBe(true)
  })

  it('estoque acima do ponto de pedido mas cobertura curta (<7 dias) também alerta', () => {
    expect(precisaRecomprar({ estoqueAtualQty: 100, reorderPointQty: 10, diasDeCobertura: 5 })).toBe(true)
  })

  it('nem estoque baixo nem cobertura curta: sem alerta', () => {
    expect(precisaRecomprar({ estoqueAtualQty: 100, reorderPointQty: 10, diasDeCobertura: 60 })).toBe(false)
  })

  it('sem consumo (diasDeCobertura null) e estoque acima do ponto: sem alerta', () => {
    expect(precisaRecomprar({ estoqueAtualQty: 100, reorderPointQty: 10, diasDeCobertura: null })).toBe(false)
  })

  it('exatamente no ponto de pedido já alerta (≤, não <)', () => {
    expect(precisaRecomprar({ estoqueAtualQty: 10, reorderPointQty: 10, diasDeCobertura: null })).toBe(true)
  })
})

describe('estadoValidade', () => {
  const hoje = Temporal.PlainDate.from('2026-08-18')

  it('sem data de validade: sempre ok', () => {
    expect(estadoValidade(hoje, null)).toBe('ok')
  })

  it('mais de 30 dias pra vencer: ok', () => {
    expect(estadoValidade(hoje, hoje.add({ days: 31 }))).toBe('ok')
  })

  it('exatamente 30 dias pra vencer: alerta', () => {
    expect(estadoValidade(hoje, hoje.add({ days: 30 }))).toBe('alerta')
  })

  it('vence hoje: bloqueado (D+0)', () => {
    expect(estadoValidade(hoje, hoje)).toBe('bloqueado')
  })

  it('já venceu: bloqueado', () => {
    expect(estadoValidade(hoje, hoje.subtract({ days: 5 }))).toBe('bloqueado')
  })
})
