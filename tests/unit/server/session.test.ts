import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { exigirAal2, exigirSessao, sessaoAtual } from '@/server/auth/session'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'

vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn() }))

type Usuario = { id: string; email: string } | null

/** Cliente de mentira com só o que a sessão consulta. */
function clienteCom(usuario: Usuario, aal: string | null = 'aal1') {
  return {
    auth: {
      getUser: async () => ({
        data: { user: usuario },
        error: usuario ? null : { message: 'Auth session missing!' },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: aal === null ? null : { currentLevel: aal } }),
      },
    },
  }
}

function comSessao(usuario: Usuario, aal: string | null = 'aal1') {
  vi.mocked(criarClienteDoUsuario).mockResolvedValue(
    clienteCom(usuario, aal) as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>,
  )
}

const REQ = new Request('https://app.ciclo.test/api/v1/clients', { method: 'GET' })

describe('sessaoAtual', () => {
  afterEach(() => vi.restoreAllMocks())

  it('devolve null sem usuário', async () => {
    comSessao(null)
    expect(await sessaoAtual()).toBeNull()
  })

  it('devolve o usuário e o nível de garantia', async () => {
    comSessao({ id: 'u-1', email: 'bruna@salao.test' }, 'aal2')
    expect(await sessaoAtual()).toEqual({ userId: 'u-1', email: 'bruna@salao.test', aal: 'aal2' })
  })

  it('assume aal1 quando o Supabase não informa o nível', async () => {
    comSessao({ id: 'u-1', email: 'bruna@salao.test' }, null)
    // Assumir aal2 por omissão liberaria exportação de base e troca de conta
    // bancária num caminho onde a resposta simplesmente não veio.
    expect((await sessaoAtual())?.aal).toBe('aal1')
  })
})

describe('guard de rota autenticada', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('rota autenticada sem sessão devolve 401 no envelope', async () => {
    comSessao(null)

    const handler = rota(async () => {
      await exigirSessao()
      return { segredo: 'nunca deveria sair daqui' }
    })
    const r = await handler(REQ, undefined)
    const corpo = (await r.json()) as { error: { code: string }; data?: unknown }

    expect(r.status).toBe(401)
    expect(corpo.error.code).toBe('UNAUTHENTICATED')
    expect(corpo.data).toBeUndefined()
    expect(JSON.stringify(corpo)).not.toContain('nunca deveria sair daqui')
  })

  it('com sessão, a rota roda normalmente', async () => {
    comSessao({ id: 'u-1', email: 'bruna@salao.test' })

    const handler = rota(async () => {
      const sessao = await exigirSessao()
      return { userId: sessao.userId }
    })
    const r = await handler(REQ, undefined)

    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ data: { userId: 'u-1' } })
  })

  it('ação sensível com sessão de senha só devolve MFA_REQUIRED', async () => {
    comSessao({ id: 'u-1', email: 'bruna@salao.test' }, 'aal1')

    const handler = rota(async () => {
      await exigirAal2()
      return { exportado: true }
    })
    const r = await handler(REQ, undefined)

    expect(r.status).toBe(401)
    expect(await r.json()).toMatchObject({ error: { code: 'MFA_REQUIRED' } })
  })

  it('ação sensível passa com o segundo fator', async () => {
    comSessao({ id: 'u-1', email: 'bruna@salao.test' }, 'aal2')

    const handler = rota(async () => {
      await exigirAal2()
      return { exportado: true }
    })
    expect((await handler(REQ, undefined)).status).toBe(200)
  })
})
