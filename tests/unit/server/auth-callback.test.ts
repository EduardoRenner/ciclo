import { afterEach, describe, expect, it, vi } from 'vitest'

import { criarClienteDoUsuario } from '@/server/db/server-client'

vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn() }))

import { GET } from '@/app/auth/callback/route'

/**
 * `/auth/callback` recebe três chegadas diferentes com a mesma URL: confirmação de e-mail,
 * redefinição de senha e — desde que o login por Google/Apple existe — o retorno do provedor de
 * OAuth. As três podem chegar com sucesso, e as três podem chegar com problema.
 */

function req(url: string): Request {
  return new Request(url)
}

function clienteQueTroca(erro: { message: string } | null) {
  return { auth: { exchangeCodeForSession: async () => ({ error: erro }) } } as unknown as Awaited<
    ReturnType<typeof criarClienteDoUsuario>
  >
}

describe('GET /auth/callback', () => {
  afterEach(() => vi.restoreAllMocks())

  it('com `code` válido, troca por sessão e manda para o destino padrão', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(clienteQueTroca(null))

    const r = await GET(req('https://app.ciclo.test/auth/callback?code=abc123'))

    expect(r.status).toBe(307)
    expect(new URL(r.headers.get('location')!).pathname).toBe('/onboarding')
  })

  it('com `code` e `next` numa rota permitida, respeita o destino pedido', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(clienteQueTroca(null))

    const r = await GET(req('https://app.ciclo.test/auth/callback?code=abc123&next=%2Fnova-senha'))

    expect(new URL(r.headers.get('location')!).pathname).toBe('/nova-senha')
  })

  it('com `next` para fora da lista permitida, ignora e cai no padrão — nunca abre redirecionamento', async () => {
    // `destino.ts` existe exatamente para isto: `next` chega por link de e-mail e por retorno de
    // OAuth, os dois canais que um atacante mais gostaria de usar como trampolim.
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(clienteQueTroca(null))

    const r = await GET(req('https://app.ciclo.test/auth/callback?code=abc123&next=https%3A%2F%2Fevil.test'))

    expect(new URL(r.headers.get('location')!).pathname).toBe('/onboarding')
  })

  it('`code` que o Supabase recusa (link de e-mail vencido ou já usado) manda para /entrar com o motivo', async () => {
    vi.mocked(criarClienteDoUsuario).mockResolvedValue(clienteQueTroca({ message: 'invalid or expired code' }))

    const r = await GET(req('https://app.ciclo.test/auth/callback?code=abc123'))

    const destino = new URL(r.headers.get('location')!)
    expect(destino.pathname).toBe('/entrar')
    expect(destino.searchParams.get('erro')).toBe('link_invalido')
  })

  it('`error` do provedor (OAuth cancelado ou negado) manda para /entrar SEM tentar trocar código', async () => {
    /*
     * Quem cancela o consentimento no Google/Apple nunca chega com `code` — o provedor devolve
     * `error=access_denied` direto, e o Supabase repassa isso sem trocar nada. Antes de este caso
     * ser tratado, ele caía no `else` de baixo: tentava `/onboarding` sem sessão nenhuma, que
     * redireciona sozinho para `/entrar` sem explicação — dois saltos silenciosos para dizer
     * "você cancelou".
     */
    const r = await GET(req('https://app.ciclo.test/auth/callback?error=access_denied&error_description=User+denied'))

    const destino = new URL(r.headers.get('location')!)
    expect(destino.pathname).toBe('/entrar')
    expect(destino.searchParams.get('erro')).toBe('login_cancelado')
    // Não pode ter tentado trocar nada — não há `code`, e chamar o Supabase aqui seria só ruído.
    expect(criarClienteDoUsuario).not.toHaveBeenCalled()
  })

  it('sem `code` e sem `error` (chegada direta, sem provedor), cai no destino padrão sem tocar o Supabase', async () => {
    const r = await GET(req('https://app.ciclo.test/auth/callback'))

    expect(new URL(r.headers.get('location')!).pathname).toBe('/onboarding')
    expect(criarClienteDoUsuario).not.toHaveBeenCalled()
  })
})
