import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { enviarEmailDeFallback } from '@/server/providers/messaging/email'

const ORIGINAL = { ...process.env }

describe('enviarEmailDeFallback', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'chave-de-teste'
    process.env.EMAIL_FROM = 'ciclo@exemplo.test'
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('sem credencial estoura em vez de tentar a rede', async () => {
    delete process.env.RESEND_API_KEY
    await expect(enviarEmailDeFallback({ to: 'a@b.com', subject: 'x', body: 'y' })).rejects.toThrow(/não configurado/)
  })

  it('manda um AbortSignal com prazo (Gate 11.2) — é o último elo do fallback, travar aqui é pior que falhar', async () => {
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ id: 'email-1' }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFalso)

    const resultado = await enviarEmailDeFallback({ to: 'a@b.com', subject: 'x', body: 'y' })
    expect(resultado).toEqual({ providerId: 'email-1' })
    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })
})
