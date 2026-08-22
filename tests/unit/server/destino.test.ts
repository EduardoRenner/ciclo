import { describe, expect, it } from 'vitest'

import { DESTINO_PADRAO, destinoSeguro } from '@/server/auth/destino'

describe('destinoSeguro', () => {
  it('deixa passar o destino real do fluxo de senha', () => {
    expect(destinoSeguro('/nova-senha')).toBe('/nova-senha')
  })

  it('cai no padrão quando não vem nada', () => {
    expect(destinoSeguro(null)).toBe(DESTINO_PADRAO)
    expect(destinoSeguro(undefined)).toBe(DESTINO_PADRAO)
    expect(destinoSeguro('')).toBe(DESTINO_PADRAO)
  })

  it.each([
    'https://evil.com',
    '//evil.com',
    // Barra invertida é o caso que derruba validação ingênua: começa com `/`,
    // não começa com `//`, e `new URL()` resolve como `https://evil.com/`.
    '/\evil.com',
    '/\\evil.com',
    '/admin/hoje?voltar=https://evil.com',
    '/rota-que-nao-existe',
  ])('recusa %s', (tentativa) => {
    expect(destinoSeguro(tentativa)).toBe(DESTINO_PADRAO)
  })
})
