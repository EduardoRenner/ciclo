import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/services/public-booking', () => ({ perfilPublico: vi.fn() }))

import { perfilPublico } from '@/server/services/public-booking'
import { generateMetadata } from '@/app/(public)/[slug]/page'

/**
 * `docs/82` §15: o link que o dono compartilha precisa de imagem. Conta nova não tem capa nem logo,
 * e antes disto a prévia no WhatsApp saía só texto. A capa, quando existe, continua mandando — a
 * rota gerada é o último recurso, nunca a primeira escolha.
 */
function perfil(extra: Record<string, unknown> = {}) {
  return { slug: 'barbearia-do-ze', name: 'Barbearia do Zé', tagline: null, about: null, coverUrl: null, logoUrl: null, ...extra }
}

const chamar = () => generateMetadata({ params: Promise.resolve({ slug: 'barbearia-do-ze' }) })

describe('prévia do link do negócio', () => {
  beforeEach(() => vi.mocked(perfilPublico).mockReset())

  it('sem capa nem logo, usa a prévia gerada e o cartão grande', async () => {
    vi.mocked(perfilPublico).mockResolvedValue(perfil() as never)
    const meta = await chamar()
    expect(meta.openGraph?.images).toBe('/barbearia-do-ze/previa')
    expect((meta.twitter as { card?: string })?.card).toBe('summary_large_image')
  })

  it('com capa, a capa do negócio continua sendo a imagem', async () => {
    vi.mocked(perfilPublico).mockResolvedValue(perfil({ coverUrl: 'https://x.supabase.co/capa.jpg' }) as never)
    expect((await chamar()).openGraph?.images).toBe('https://x.supabase.co/capa.jpg')
  })

  it('só com logo, o logo (quadrado) vai no cartão pequeno', async () => {
    vi.mocked(perfilPublico).mockResolvedValue(perfil({ logoUrl: 'https://x.supabase.co/logo.png' }) as never)
    const meta = await chamar()
    expect(meta.openGraph?.images).toBe('https://x.supabase.co/logo.png')
    expect((meta.twitter as { card?: string })?.card).toBe('summary')
  })
})
