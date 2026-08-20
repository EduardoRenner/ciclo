import { afterEach, describe, expect, it, vi } from 'vitest'

import { criarClienteDoUsuario } from '@/server/db/server-client'

import { DELETE as removerFator } from '@/app/api/v1/auth/mfa/factors/[id]/route'
import { GET as listarFatores } from '@/app/api/v1/auth/mfa/factors/route'
import { POST as cadastrarFator } from '@/app/api/v1/auth/mfa/enroll/route'
import { POST as verificarFator } from '@/app/api/v1/auth/mfa/verify/route'
import { POST as entrar } from '@/app/api/v1/auth/login/route'

vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn() }))

const USUARIO = { id: 'u-1', email: 'bruna@salao.test' }
const FATOR_ID = '11111111-1111-4111-8111-111111111111'

/** Cliente de mentira com só o que as rotas de MFA consultam. */
function clienteCom(opcoes: {
  aal?: string | null
  enroll?: { data?: unknown; error?: unknown }
  challengeAndVerify?: { error?: unknown }
  listFactors?: { data?: unknown; error?: unknown }
  unenroll?: { error?: unknown }
}) {
  const aal = opcoes.aal ?? 'aal1'
  return {
    auth: {
      getUser: async () => ({ data: { user: USUARIO }, error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aal } }),
        enroll: vi.fn(async () => opcoes.enroll ?? { data: null, error: { message: 'não configurado no teste' } }),
        challengeAndVerify: vi.fn(async () => opcoes.challengeAndVerify ?? { error: { message: 'não configurado no teste' } }),
        listFactors: vi.fn(async () => opcoes.listFactors ?? { data: { totp: [] }, error: null }),
        unenroll: vi.fn(async () => opcoes.unenroll ?? { error: null }),
      },
    },
  }
}

function comCliente(cliente: ReturnType<typeof clienteCom>) {
  vi.mocked(criarClienteDoUsuario).mockResolvedValue(cliente as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>)
  return cliente
}

function reqJson(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/auth/mfa/enroll', () => {
  afterEach(() => vi.restoreAllMocks())

  it('devolve qrCode e secret com sessão válida', async () => {
    comCliente(
      clienteCom({
        enroll: { data: { id: FATOR_ID, totp: { qr_code: 'data:image/png;base64,xxx', secret: 'ABCDEF', uri: 'otpauth://x' } }, error: null },
      }),
    )

    const r = await cadastrarFator(new Request('https://app.ciclo.test/api/v1/auth/mfa/enroll', { method: 'POST' }), undefined)
    const corpo = (await r.json()) as { data: { factorId: string; qrCode: string; secret: string } }

    expect(r.status).toBe(200)
    expect(corpo.data).toEqual({ factorId: FATOR_ID, qrCode: 'data:image/png;base64,xxx', secret: 'ABCDEF' })
  })

  it('sem sessão devolve 401', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(
      clienteCom({}) as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>,
    )
    vi.mocked(criarClienteDoUsuario).mockResolvedValueOnce({
      auth: { getUser: async () => ({ data: { user: null }, error: { message: 'Auth session missing!' } }) },
    } as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>)

    const r = await cadastrarFator(new Request('https://app.ciclo.test/api/v1/auth/mfa/enroll', { method: 'POST' }), undefined)
    expect(r.status).toBe(401)
  })

  it('erro do Supabase vira INTERNAL', async () => {
    comCliente(clienteCom({ enroll: { data: null, error: { message: 'falhou' } } }))

    const r = await cadastrarFator(new Request('https://app.ciclo.test/api/v1/auth/mfa/enroll', { method: 'POST' }), undefined)
    const corpo = (await r.json()) as { error: { code: string } }

    expect(r.status).toBe(500)
    expect(corpo.error.code).toBe('INTERNAL')
  })
})

describe('POST /api/v1/auth/mfa/verify', () => {
  afterEach(() => vi.restoreAllMocks())

  it('código certo devolve ok', async () => {
    const cliente = comCliente(clienteCom({ challengeAndVerify: { error: null } }))

    const r = await verificarFator(
      reqJson('https://app.ciclo.test/api/v1/auth/mfa/verify', { factorId: FATOR_ID, code: '123456' }),
      undefined,
    )

    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ data: { ok: true } })
    expect(cliente.auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: FATOR_ID, code: '123456' })
  })

  it('código errado devolve VALIDATION_ERROR, não vaza a mensagem do Supabase', async () => {
    comCliente(clienteCom({ challengeAndVerify: { error: { message: 'invalid TOTP code entered' } } }))

    const r = await verificarFator(
      reqJson('https://app.ciclo.test/api/v1/auth/mfa/verify', { factorId: FATOR_ID, code: '000000' }),
      undefined,
    )
    const corpo = (await r.json()) as { error: { code: string; message: string } }

    expect(r.status).toBe(422)
    expect(corpo.error.code).toBe('VALIDATION_ERROR')
    expect(corpo.error.message).not.toContain('TOTP')
  })

  it('código com formato inválido nem chega a chamar o Supabase', async () => {
    const cliente = comCliente(clienteCom({}))

    const r = await verificarFator(
      reqJson('https://app.ciclo.test/api/v1/auth/mfa/verify', { factorId: FATOR_ID, code: 'abc' }),
      undefined,
    )

    expect(r.status).toBe(422)
    expect(cliente.auth.mfa.challengeAndVerify).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/auth/mfa/factors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lista fatores mapeando os campos que a UI usa', async () => {
    comCliente(
      clienteCom({
        listFactors: { data: { totp: [{ id: FATOR_ID, status: 'verified', created_at: '2026-08-20T00:00:00Z' }] }, error: null },
      }),
    )

    const r = await listarFatores(new Request('https://app.ciclo.test/api/v1/auth/mfa/factors'), undefined)
    expect(await r.json()).toMatchObject({
      data: { factors: [{ id: FATOR_ID, status: 'verified', createdAt: '2026-08-20T00:00:00Z' }] },
    })
  })
})

describe('DELETE /api/v1/auth/mfa/factors/[id]', () => {
  afterEach(() => vi.restoreAllMocks())

  function ctx() {
    return { params: Promise.resolve({ id: FATOR_ID }) }
  }

  it('com aal2 remove o fator', async () => {
    const cliente = comCliente(clienteCom({ aal: 'aal2', unenroll: { error: null } }))

    const r = await removerFator(new Request('https://app.ciclo.test/api/v1/auth/mfa/factors/' + FATOR_ID, { method: 'DELETE' }), ctx())

    expect(r.status).toBe(200)
    expect(cliente.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: FATOR_ID })
  })

  it('sem aal2 (só senha) devolve MFA_REQUIRED e não chama unenroll', async () => {
    const cliente = comCliente(clienteCom({ aal: 'aal1' }))

    const r = await removerFator(new Request('https://app.ciclo.test/api/v1/auth/mfa/factors/' + FATOR_ID, { method: 'DELETE' }), ctx())
    const corpo = (await r.json()) as { error: { code: string } }

    expect(r.status).toBe(401)
    expect(corpo.error.code).toBe('MFA_REQUIRED')
    expect(cliente.auth.mfa.unenroll).not.toHaveBeenCalled()
  })

  it('id que não é UUID devolve NOT_FOUND', async () => {
    comCliente(clienteCom({ aal: 'aal2' }))

    const r = await removerFator(
      new Request('https://app.ciclo.test/api/v1/auth/mfa/factors/nao-e-uuid', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'nao-e-uuid' }) },
    )

    expect(r.status).toBe(404)
  })
})

describe('POST /api/v1/auth/login · desafio de MFA', () => {
  afterEach(() => vi.restoreAllMocks())

  /** Cliente de login: soma o que `signInWithPassword` e o `from(memberships)` do fim da rota usam. */
  function clienteLogin(opcoes: { nextLevel?: string | null; fatorVerificado?: boolean }) {
    return {
      auth: {
        signInWithPassword: async () => ({
          data: { session: { expires_at: 999 }, user: { id: USUARIO.id, email: USUARIO.email } },
          error: null,
        }),
        mfa: {
          getAuthenticatorAssuranceLevel: async () => ({
            data: { currentLevel: 'aal1', nextLevel: opcoes.nextLevel ?? 'aal1' },
          }),
          listFactors: async () => ({
            data: { totp: opcoes.fatorVerificado ? [{ id: FATOR_ID, status: 'verified' }] : [] },
          }),
        },
      },
      from: () => ({
        select: () => ({ eq: () => ({ eq: async () => ({ data: [] }) }) }),
      }),
    }
  }

  const CORPO_LOGIN = { email: USUARIO.email, password: 'senha-correta' }

  it('conta com TOTP verificado pede o código em vez de devolver os tenants', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(
      clienteLogin({ nextLevel: 'aal2', fatorVerificado: true }) as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>,
    )

    const r = await entrar(reqJson('https://app.ciclo.test/api/v1/auth/login', CORPO_LOGIN), undefined)
    const corpo = (await r.json()) as { data: { mfaRequired?: boolean; factorId?: string; tenants?: unknown } }

    expect(r.status).toBe(200)
    expect(corpo.data).toEqual({ mfaRequired: true, factorId: FATOR_ID })
    expect(corpo.data.tenants).toBeUndefined()
  })

  it('conta sem segundo fator segue direto pros tenants', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(
      clienteLogin({ nextLevel: 'aal1' }) as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>,
    )

    const r = await entrar(reqJson('https://app.ciclo.test/api/v1/auth/login', CORPO_LOGIN), undefined)
    const corpo = (await r.json()) as { data: { mfaRequired?: boolean; tenants?: unknown[] } }

    expect(r.status).toBe(200)
    expect(corpo.data.mfaRequired).toBeUndefined()
    expect(corpo.data.tenants).toEqual([])
  })

  it('nextLevel pede aal2 mas o fator ainda não foi verificado (cadastro pela metade) segue direto', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(
      clienteLogin({ nextLevel: 'aal2', fatorVerificado: false }) as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>,
    )

    const r = await entrar(reqJson('https://app.ciclo.test/api/v1/auth/login', CORPO_LOGIN), undefined)
    const corpo = (await r.json()) as { data: { mfaRequired?: boolean } }

    expect(corpo.data.mfaRequired).toBeUndefined()
  })
})
