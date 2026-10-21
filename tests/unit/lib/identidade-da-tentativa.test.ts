import { describe, expect, it } from 'vitest'

import { identidadeDaTentativa } from '@/lib/tentativa'

describe('a identidade da tentativa distingue uploads diferentes (APR-224)', () => {
  it('dois FormData com arquivos diferentes para a mesma URL têm identidades diferentes', () => {
    const a = new FormData()
    a.append('file', new File(['x'.repeat(10)], 'frente.jpg'))
    const b = new FormData()
    b.append('file', new File(['y'.repeat(20)], 'perfil.jpg'))
    expect(identidadeDaTentativa('/api/v1/clients/1/media', { method: 'POST', body: a })).not.toBe(
      identidadeDaTentativa('/api/v1/clients/1/media', { method: 'POST', body: b }),
    )
  })

  it('o mesmo corpo JSON dá a mesma identidade (é o reenvio que tem que reusar a chave)', () => {
    const init = { method: 'POST', body: JSON.stringify({ a: 1 }) }
    expect(identidadeDaTentativa('/x', init)).toBe(identidadeDaTentativa('/x', init))
    expect(identidadeDaTentativa('/x', init)).not.toBe(identidadeDaTentativa('/x', { method: 'POST', body: JSON.stringify({ a: 2 }) }))
  })
})
