import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchComTentativa, tentativasEmAberto } from '@/lib/tentativa'

function chaveDe(chamada: unknown[]): string | null {
  return new Headers((chamada[1] as RequestInit).headers).get('idempotency-key')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchComTentativa (APR-007)', () => {
  it('duplo toque com o mesmo corpo, os dois em voo: a MESMA chave', async () => {
    const fetchFalso = vi.fn(() => new Promise<Response>((ok) => setTimeout(() => ok(new Response('{}', { status: 200 })), 5)))
    vi.stubGlobal('fetch', fetchFalso)
    const corpo = JSON.stringify({ serviceId: 'a', qty: 1 })
    await Promise.all([
      fetchComTentativa('/api/v1/tickets/1/items', { method: 'POST', body: corpo }),
      fetchComTentativa('/api/v1/tickets/1/items', { method: 'POST', body: corpo }),
    ])
    expect(chaveDe(fetchFalso.mock.calls[0]!)).toBeTruthy()
    expect(chaveDe(fetchFalso.mock.calls[0]!)).toBe(chaveDe(fetchFalso.mock.calls[1]!))
  })

  it('mesmo item de novo DEPOIS do sucesso: chave nova (dois itens iguais são legítimos)', async () => {
    const fetchFalso = vi.fn(async () => new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchFalso)
    const corpo = JSON.stringify({ serviceId: 'a', qty: 1 })
    await fetchComTentativa('/api/v1/tickets/1/items', { method: 'POST', body: corpo })
    await fetchComTentativa('/api/v1/tickets/1/items', { method: 'POST', body: corpo })
    expect(chaveDe(fetchFalso.mock.calls[0]!)).not.toBe(chaveDe(fetchFalso.mock.calls[1]!))
    expect(tentativasEmAberto()).toBe(0)
  })

  it('rede caiu: o reenvio usa a MESMA chave', async () => {
    const fetchFalso = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchFalso)
    const corpo = JSON.stringify({ startsAt: '2026-10-15T12:00:00Z' })
    await expect(fetchComTentativa('/api/v1/appointments', { method: 'POST', body: corpo })).rejects.toThrow()
    await fetchComTentativa('/api/v1/appointments', { method: 'POST', body: corpo })
    expect(chaveDe(fetchFalso.mock.calls[0]!)).toBe(chaveDe(fetchFalso.mock.calls[1]!))
  })

  it('5xx mantém a chave; 4xx encerra a tentativa', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{}', { status: 422 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchFalso)
    const corpo = JSON.stringify({ x: 1 })
    await fetchComTentativa('/api/v1/x', { method: 'POST', body: corpo })
    await fetchComTentativa('/api/v1/x', { method: 'POST', body: corpo })
    await fetchComTentativa('/api/v1/x', { method: 'POST', body: corpo })
    const [a, b, c] = fetchFalso.mock.calls.map((ch) => chaveDe(ch))
    expect(a).toBe(b)
    expect(c).not.toBe(b)
  })

  it('429 com Retry-After (1º toque ainda gravando): espera e devolve a resposta do 1º', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '0.01' } }))
      .mockResolvedValueOnce(new Response('{"data":{"id":"1"}}', { status: 201 }))
    vi.stubGlobal('fetch', fetchFalso)
    const r = await fetchComTentativa('/api/v1/tickets/1/items', { method: 'POST', body: '{"q":1}' })
    expect(r.status).toBe(201)
    expect(fetchFalso).toHaveBeenCalledTimes(2)
    expect(chaveDe(fetchFalso.mock.calls[0]!)).toBe(chaveDe(fetchFalso.mock.calls[1]!))
    expect(tentativasEmAberto()).toBe(0)
  })

  it('corpo diferente é outra tentativa, com outra chave', async () => {
    const fetchFalso = vi.fn(() => new Promise<Response>((ok) => setTimeout(() => ok(new Response('{}', { status: 200 })), 5)))
    vi.stubGlobal('fetch', fetchFalso)
    await Promise.all([
      fetchComTentativa('/api/v1/x', { method: 'POST', body: '{"a":1}' }),
      fetchComTentativa('/api/v1/x', { method: 'POST', body: '{"a":2}' }),
    ])
    expect(chaveDe(fetchFalso.mock.calls[0]!)).not.toBe(chaveDe(fetchFalso.mock.calls[1]!))
  })
})
