import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { criarClienteDoUsuario } from '@/server/db/server-client'

import { POST as cadastrar } from '@/app/api/v1/auth/signup/route'

vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn(), exigirEnv: () => 'https://app.ciclo.test' }))
vi.mock('@/server/http/limite-publico', () => ({ limitarRotaPublica: vi.fn(async () => undefined) }))
vi.mock('@/server/auth/password', () => ({ exigirSenhaForte: vi.fn(async () => undefined), SENHA_MINIMA: 8 }))
vi.mock('@/server/services/rate-limit', () => ({ limitador: vi.fn(async () => ({ permitido: true })) }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))

/**
 * docs/98-aprimoramento/11 LOJA-02. Sem SMTP próprio o Supabase só entrega e-mail para quem é do time
 * da organização: para todo o resto o `signUp` devolve 400 `email_address_not_authorized`. A rota tratava
 * só 429 e >= 500, então esse 400 virava "mandamos o link" e a pessoa ficava esperando um e-mail que
 * nunca sai. Aconteceu em produção (15/10/2026) sem ninguém ver.
 *
 * docs/114 L-03 (decisão do Vitor, 21/10): o cadastro passou a ser com nome, WhatsApp e senha, sem
 * e-mail. A regra que esta guarda segura continua a mesma: a rota nunca diz que deu certo quando a conta
 * não abriu. Agora o equivalente do e-mail que não sai é a confirmação de telefone ligada no painel, que
 * deixa o `signUp` sem sessão esperando um código que não sai.
 */
const CORPO = { password: 'uma-senha-bem-comprida-9', fullName: 'Ana Souza', phone: '(11) 98765-4321' }

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

describe('POST /api/v1/auth/signup · número e senha (L-03)', () => {
  let erroNoLog: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    erroNoLog = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('caminho feliz: a conta abre na hora, criada pelo número e sem e-mail', async () => {
    const signUp = signUpDevolve(null, { access_token: 'sessao-de-teste' })
    const { status, corpo } = await post()
    expect(status).toBe(200)
    expect(corpo.data?.status).toBe('conta_criada')
    const chamada = (signUp.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(chamada.phone).toBe('+5511987654321')
    expect(chamada).not.toHaveProperty('email')
  })

  it('sem sessão (confirmação de telefone ligada) não vira "conta criada", e fica no log', async () => {
    signUpDevolve(null, null)
    const { status, corpo } = await post()
    expect(corpo.data?.status, 'a rota disse que abriu uma conta que não abriu').toBeUndefined()
    expect(status).toBe(500)
    expect(erroNoLog.mock.calls.map((c) => String(c[0])).join('\n')).toContain('signup_numero_sem_sessao')
  })

  it('número que já tem conta volta para o campo, mandando entrar', async () => {
    signUpDevolve({ status: 422, code: 'phone_exists', message: 'Phone number already registered' })
    const { status, corpo } = await post()
    expect(status).toBe(422)
    expect(corpo.error?.code).toBe('VALIDATION_ERROR')
    expect(corpo.data?.status).toBeUndefined()
  })

  it('senha fraca volta para o campo da senha', async () => {
    signUpDevolve({ status: 422, code: 'weak_password', message: 'weak' })
    const { status, corpo } = await post()
    expect(status).toBe(422)
    expect(corpo.error?.code).toBe('VALIDATION_ERROR')
  })

  it('recusa desconhecida do Auth é erro, nunca "conta criada"', async () => {
    signUpDevolve({ status: 400, code: 'algo_novo', message: '?' })
    const { status, corpo } = await post()
    expect(corpo.data?.status).toBeUndefined()
    expect(status).toBe(500)
  })
})
