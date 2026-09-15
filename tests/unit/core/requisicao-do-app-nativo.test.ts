import { describe, expect, it } from 'vitest'

import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'

describe('ehRequisicaoDoAppNativo', () => {
  it('reconhece o User-Agent que o app nativo manda', () => {
    expect(ehRequisicaoDoAppNativo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) CicloApp')).toBe(true)
    expect(ehRequisicaoDoAppNativo('Mozilla/5.0 (Linux; Android 14) CicloApp')).toBe(true)
  })

  it('não reconhece navegador comum, mesmo em iPhone/Android', () => {
    expect(ehRequisicaoDoAppNativo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1')).toBe(false)
    expect(ehRequisicaoDoAppNativo('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0')).toBe(false)
  })

  it('User-Agent ausente não é o app nativo', () => {
    expect(ehRequisicaoDoAppNativo(null)).toBe(false)
    expect(ehRequisicaoDoAppNativo('')).toBe(false)
  })
})
