import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { urlDaVitrine } from '@/core/text/vitrine'

/**
 * O banco guarda a CHAVE (`{tenantId}/{uuid}.webp`), nunca a URL. Quem monta o endereço é esta
 * função, num lugar só — são dois pedaços que precisam concordar (origem do Supabase e nome do
 * bucket) e errar qualquer um deles não dá erro: dá imagem quebrada na página pública.
 */
describe('urlDaVitrine', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv
  })

  it('monta o caminho do bucket público da vitrine', () => {
    expect(urlDaVitrine('abc-123/foto.webp')).toBe(
      'https://exemplo.supabase.co/storage/v1/object/public/vitrine/abc-123/foto.webp',
    )
  })

  /**
   * Casa com o defeito, não com o nome da função: se alguém apontar para `media` — o bucket
   * PRIVADO, que guarda foto de cliente —, a imagem some da página e, pior, a chave de um objeto
   * privado passa a ser montada como se fosse pública.
   */
  it('nunca aponta para o bucket privado de foto de cliente', () => {
    const url = urlDaVitrine('abc-123/foto.webp')!
    expect(url).toContain('/public/vitrine/')
    expect(url).not.toContain('/media/')
  })

  it('não duplica a barra quando a origem termina em /', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co/'
    expect(urlDaVitrine('a/b.webp')).toBe('https://exemplo.supabase.co/storage/v1/object/public/vitrine/a/b.webp')
  })

  /**
   * `null` e não string vazia: `<img src="">` é resolvido pelo navegador como "a página atual",
   * então a página baixaria o próprio HTML de novo como se fosse imagem.
   */
  it('devolve null quando não há imagem, para a tela não desenhar img vazia', () => {
    expect(urlDaVitrine(null)).toBeNull()
    expect(urlDaVitrine(undefined)).toBeNull()
    expect(urlDaVitrine('')).toBeNull()
  })

  it('devolve null quando a origem do Supabase não está configurada', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(urlDaVitrine('a/b.webp')).toBeNull()
  })
})
