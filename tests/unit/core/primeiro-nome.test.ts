import { describe, expect, it } from 'vitest'

import { primeiroNome } from '@/core/text/nome'

describe('primeiroNome', () => {
  it('devolve só o primeiro nome', () => {
    expect(primeiroNome('Bruna Oliveira Santos')).toBe('Bruna')
  })

  it('lida com espaço extra nas bordas e no meio', () => {
    expect(primeiroNome('  Bruna   Oliveira  ')).toBe('Bruna')
  })

  it('nome de uma palavra só volta inteiro', () => {
    expect(primeiroNome('Bruna')).toBe('Bruna')
  })

  it('string vazia não quebra', () => {
    expect(primeiroNome('')).toBe('')
  })
})
