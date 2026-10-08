import { describe, expect, it } from 'vitest'

import { mascaraCnj } from '@/core/advocacia/intimacoes'

describe('mascaraCnj', () => {
  it('formata os 20 dígitos no padrão do CNJ', () => {
    expect(mascaraCnj('00012345620268240001')).toBe('0001234-56.2026.8.24.0001')
  })
  it('o que não tem 20 dígitos volta igual', () => {
    expect(mascaraCnj('123')).toBe('123')
    expect(mascaraCnj('0001234-56.2026.8.24.0001')).toBe('0001234-56.2026.8.24.0001')
  })
})
