import { describe, expect, it } from 'vitest'

import { compararComCostume } from '@/core/ciclo/comparacao-com-costume'

describe('compararComCostume', () => {
  it('amostra menor que o piso não compara nada', () => {
    expect(compararComCostume([], 30_000)).toBeNull()
    expect(compararComCostume([20_000], 30_000)).toBeNull()
  })

  it('acima do costume dá percentual positivo', () => {
    // Média de 20000; hoje 30000 → +50%.
    expect(compararComCostume([20_000, 20_000], 30_000)).toEqual({ percentual: 50 })
  })

  it('abaixo do costume dá percentual negativo', () => {
    // Média de 20000; hoje 10000 → -50%.
    expect(compararComCostume([20_000, 20_000], 10_000)).toEqual({ percentual: -50 })
  })

  it('exatamente na média dá zero, não "null" nem erro', () => {
    expect(compararComCostume([20_000, 30_000], 25_000)).toEqual({ percentual: 0 })
  })

  it('média zerada (salão sempre fechou nesse dia) não compara — divisão por zero seria pior que não mostrar', () => {
    expect(compararComCostume([0, 0, 0], 5_000)).toBeNull()
  })

  it('hoje zerado com costume positivo dá -100%, não null', () => {
    expect(compararComCostume([10_000, 10_000], 0)).toEqual({ percentual: -100 })
  })
})
