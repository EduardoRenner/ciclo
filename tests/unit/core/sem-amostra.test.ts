import { describe, expect, it } from 'vitest'

import { SEM_AMOSTRA, percentualOuTraco } from '@/core/text/sem-amostra'

/**
 * A regra tem dois lados, e guardar só um deixa o outro cair. Nasceu de uma guarda cega: a versão
 * anterior procurava `acertoBps === null` no JSX da tela do mês, e passou VERDE com o defeito
 * reintroduzido — a mesma comparação existia noutra linha, no texto de apoio.
 */
describe('percentualOuTraco — "não sei" não é zero, e zero não é "não sei"', () => {
  it('sem amostra vira traço, nunca 0%', () => {
    expect(percentualOuTraco(null)).toBe(SEM_AMOSTRA)
    expect(percentualOuTraco(undefined)).toBe(SEM_AMOSTRA)
    expect(percentualOuTraco(null), 'acusa o produto de um erro que ele não cometeu').not.toContain('0')
  })

  /** A outra metade: esconder um zero MEDIDO é o mesmo defeito na direção oposta. */
  it('zero medido é 0%, e aparece', () => {
    expect(percentualOuTraco(0)).toBe('0%')
  })

  it('converte basis points e arredonda', () => {
    expect(percentualOuTraco(6_200)).toBe('62%')
    expect(percentualOuTraco(10_000)).toBe('100%')
    expect(percentualOuTraco(6_250)).toBe('63%')
  })
})
