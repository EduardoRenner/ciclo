import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { criarClienteDoUsuario } from '@/server/db/server-client'

import { POST as reenviar } from '@/app/api/v1/auth/signup/resend/route'
import { POST as cadastrar } from '@/app/api/v1/auth/signup/route'

vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn(), exigirEnv: () => 'https://app.ciclo.test' }))
vi.mock('@/server/http/limite-publico', () => ({ limitarRotaPublica: vi.fn(async () => undefined) }))
vi.mock('@/server/auth/password', () => ({ exigirSenhaForte: vi.fn(async () => undefined) }))
vi.mock('@/server/services/rate-limit', () => ({ limitador: vi.fn(async () => ({ permitido: true })) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

/**
 * docs/98-aprimoramento/11 LOJA-02. Sem SMTP próprio o Supabase só entrega e-mail para quem é do time
 * da organização: para todo o resto o `signUp` devolve 400 `email_address_not_authorized`. A rota tratava
 * só 429 e >= 500, então esse 400 virava "mandamos o link" e a pessoa ficava esperando um e-mail que
 * nunca sai. Aconteceu em produção (15/10/2026) sem ninguém ver.
 *
 * A resposta igual para e-mail novo e e-mail já cadastrado continua valendo para os outros 400: é ela que
 * impede o cadastro de virar um verificador de quem tem conta.
 */
const CORPO = { email: 'ana@salao.test', password: 'uma-senha-bem-comprida-9', fullName: 'Ana Souza', phone: '(11) 98765-4321' }

function signUpDevolve(error: { status?: number; code?: string; message?: string } | null, session: { access_token: string } | null = null) {
  const signUp = vi.fn(async () => ({ data: { user: null, session }, error }))
  vi.mocked(criarClienteDoUsuario).mockResolvedValue({ auth: { signUp } } as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>)
  return signUp
}

async function post() {
  const r = await cadastrar(
    new Request('https://app.ciclo.test/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(CORPO),
    }),
    undefined,
  )
  return { status: r.status, corpo: (await r.json()) as { data?: { status: string }; error?: { code: string; message: string } } }
}

describe('POST /api/v1/auth/signup · falha de envio do e-mail', () => {
  let erroNoLog: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    erroNoLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('caminho feliz: confirma que o e-mail saiu', async () => {
    signUpDevolve(null)
    const { status, corpo } = await post()
    expect(status).toBe(200)
    expect(corpo.data?.status).toBe('confirmacao_enviada')
  })

  it('e-mail recusado pelo SMTP do Supabase não vira "mandamos o link"', async () => {
    signUpDevolve({ status: 400, code: 'email_address_not_authorized', message: 'Email address not authorized' })
    const { status, corpo } = await post()
    expect(corpo.data?.status, 'a rota disse que mandou um e-mail que não saiu').toBeUndefined()
    expect(status).toBe(503)
    expect(corpo.error?.code).toBe('EMAIL_UNAVAILABLE')
    expect(corpo.error?.message).toMatch(/não conseguimos enviar/i)
  })

  it('a falha de envio fica registrada com evento próprio, sem o e-mail da pessoa', async () => {
    signUpDevolve({ status: 400, code: 'email_address_not_authorized', message: 'Email address not authorized' })
    await post()
    const linhas = erroNoLog.mock.calls.map((c) => String(c[0]))
    const evento = linhas.find((l) => l.includes('"event":"signup_email_nao_enviado"'))
    expect(evento, 'nenhum evento de falha de e-mail no log').toBeDefined()
    expect(evento).toContain('email_address_not_authorized')
    expect(linhas.join('\n')).not.toContain(CORPO.email)
  })

  it('e-mail que o provedor considera inválido volta para o campo, em vez de "mandamos o link"', async () => {
    signUpDevolve({ status: 400, code: 'email_address_invalid', message: 'Email address "ana@salao.test" is invalid' })
    const { status, corpo } = await post()
    expect(corpo.data?.status).toBeUndefined()
    expect(status).toBe(422)
    expect(corpo.error?.code).toBe('VALIDATION_ERROR')
  })

  it('sem confirmação de e-mail no Supabase, a conta abre na hora (docs/108 M8)', async () => {
    signUpDevolve(null, { access_token: 'sessao-de-teste' })
    const { status, corpo } = await post()
    expect(status).toBe(200)
    expect(corpo.data?.status).toBe('conta_criada')
  })

  it('com a confirmação ligada (sem sessão), segue dizendo que mandou o link', async () => {
    signUpDevolve(null, null)
    expect((await post()).corpo.data?.status).toBe('confirmacao_enviada')
  })

  it('os outros 400 continuam com a resposta igual (anti-enumeração)', async () => {
    signUpDevolve({ status: 400, code: 'user_already_exists', message: 'User already registered' })
    const { status, corpo } = await post()
    expect(status).toBe(200)
    expect(corpo.data?.status).toBe('confirmacao_enviada')
  })
})

describe('POST /api/v1/auth/signup/resend · falha de envio do e-mail', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined))
  afterEach(() => vi.restoreAllMocks())

  function resendDevolve(error: { status?: number; code?: string } | null) {
    const resend = vi.fn(async () => ({ data: {}, error }))
    vi.mocked(criarClienteDoUsuario).mockResolvedValue({ auth: { resend } } as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>)
  }
  async function post() {
    const r = await reenviar(
      new Request('https://app.ciclo.test/api/v1/auth/signup/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: CORPO.email }),
      }),
      undefined,
    )
    return { status: r.status, corpo: (await r.json()) as { data?: { status: string }; error?: { code: string } } }
  }

  it('caminho feliz: reenviado', async () => {
    resendDevolve(null)
    expect((await post()).corpo.data?.status).toBe('reenviado')
  })

  it('envio recusado pelo provedor não vira "reenviado"', async () => {
    resendDevolve({ status: 400, code: 'email_address_not_authorized' })
    const { status, corpo } = await post()
    expect(corpo.data?.status).toBeUndefined()
    expect(status).toBe(503)
    expect(corpo.error?.code).toBe('EMAIL_UNAVAILABLE')
  })
})
