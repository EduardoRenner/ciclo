import { cookies } from 'next/headers'
import { describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/v1/auth/logout/route'
import { criarClienteDoUsuario } from '@/server/db/server-client'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn() }))

/**
 * docs/112, achado de 21/10: o cookie `ciclo_tenant` (gravado ao aceitar convite) sobrevivia ao
 * "sair", e quem entrava depois no mesmo aparelho, num tablet de balcão, herdava a escolha de outra
 * pessoa. `contextoAtual` já ignora cookie que não bate; sair também tem de esquecê-lo.
 */
describe('sair da conta esquece o estabelecimento lembrado no aparelho', () => {
  it('apaga o cookie ciclo_tenant e encerra a sessão', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(criarClienteDoUsuario).mockResolvedValue({ auth: { signOut } } as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>)
    const apagar = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ get: () => undefined, delete: apagar } as unknown as Awaited<ReturnType<typeof cookies>>)

    const resposta = await POST(
      new Request('https://app.ciclo.test/api/v1/auth/logout', { method: 'POST', headers: { 'Idempotency-Key': 'k-1' } }),
      undefined,
    )

    expect(resposta.status).toBe(200)
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(apagar).toHaveBeenCalledWith('ciclo_tenant')
  })
})
