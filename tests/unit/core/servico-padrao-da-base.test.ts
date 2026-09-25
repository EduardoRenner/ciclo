import { describe, expect, it } from 'vitest'

import { servicoPadraoDaBase } from '@/core/cycle/servico-padrao-da-base'

/** O pacote de barbearia como ele nasce: tudo em `position` 0, então a lista sai em ordem alfabética. */
const BARBEARIA_NOVA = [
  { id: 'barba', cycleDays: 14, atendimentos: 0 },
  { id: 'corte', cycleDays: 21, atendimentos: 0 },
  { id: 'corte-barba', cycleDays: 21, atendimentos: 0 },
  { id: 'infantil', cycleDays: 25, atendimentos: 0 },
  { id: 'pigmentacao', cycleDays: 30, atendimentos: 0 },
  { id: 'platinado', cycleDays: 40, atendimentos: 0 },
]

describe('servicoPadraoDaBase (docs/82 §7)', () => {
  it('conta nova de barbearia vem com Corte, não com Barba (o ciclo mais curto, que vinha por ordem alfabética)', () => {
    expect(servicoPadraoDaBase(BARBEARIA_NOVA)).toBe('corte')
  })

  it('com histórico, vale o serviço mais atendido — mesmo que não seja o do meio', () => {
    const comHistorico = BARBEARIA_NOVA.map((s) => (s.id === 'corte-barba' ? { ...s, atendimentos: 40 } : s.id === 'corte' ? { ...s, atendimentos: 12 } : s))
    expect(servicoPadraoDaBase(comHistorico)).toBe('corte-barba')
  })

  it('um atendimento só já é histórico', () => {
    const umSo = BARBEARIA_NOVA.map((s) => (s.id === 'platinado' ? { ...s, atendimentos: 1 } : s))
    expect(servicoPadraoDaBase(umSo)).toBe('platinado')
  })

  it('número par de serviços: fica com a mediana de baixo, nunca com o mais curto', () => {
    expect(
      servicoPadraoDaBase([
        { id: 'a', cycleDays: 10, atendimentos: 0 },
        { id: 'b', cycleDays: 20, atendimentos: 0 },
        { id: 'c', cycleDays: 30, atendimentos: 0 },
        { id: 'd', cycleDays: 60, atendimentos: 0 },
      ]),
    ).toBe('b')
  })

  it('um serviço só: é ele', () => {
    expect(servicoPadraoDaBase([{ id: 'unico', cycleDays: 30, atendimentos: 0 }])).toBe('unico')
  })

  it('sem serviço: sem padrão', () => {
    expect(servicoPadraoDaBase([])).toBeNull()
  })
})
