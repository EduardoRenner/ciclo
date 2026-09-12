import { describe, expect, it } from 'vitest'

import { usoDoPlano } from '@/core/loyalty/uso-do-plano'

describe('usoDoPlano', () => {
  it('plano ilimitado nunca excede e não conta restantes', () => {
    expect(usoDoPlano(null, 999)).toEqual({ restantes: null, excedeu: false })
  })

  it('dentro do limite: restantes positivo, sem exceder', () => {
    expect(usoDoPlano(4, 2)).toEqual({ restantes: 2, excedeu: false })
  })

  it('bateu exatamente no limite: zero restante, ainda não excedeu', () => {
    expect(usoDoPlano(4, 4)).toEqual({ restantes: 0, excedeu: false })
  })

  it('passou do limite: excedeu, e restantes não fica negativo', () => {
    expect(usoDoPlano(4, 6)).toEqual({ restantes: 0, excedeu: true })
  })
})
