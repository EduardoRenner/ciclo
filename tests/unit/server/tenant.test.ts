import { cookies } from 'next/headers'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/server/db/server-client', () => ({ criarClienteDoUsuario: vi.fn() }))

const TENANT_A = '11111111-1111-4111-8111-111111111111'
const TENANT_B = '22222222-2222-4222-8222-222222222222'

type DadosTenant = { name: string; slug: string; timezone: string; vertical: string | null }
type Vinculo = { tenant_id: string; role: string; tenants: DadosTenant }

/**
 * O `select` de memberships passou a trazer os dados do tenant de carona (`docs/28` §8), então o
 * vínculo de mentira também precisa deles — sem isso o `contextoAtual` recusa com
 * `TENANT_MISMATCH`, que é o comportamento certo para membership apontando para tenant que sumiu.
 */
function vinculo(tenantId: string, role: string): Vinculo {
  return { tenant_id: tenantId, role, tenants: { name: 'Salão de Teste', slug: 'salao-de-teste', timezone: 'America/Sao_Paulo', vertical: null } }
}

/**
 * Cliente de mentira que responde `getUser` e a consulta de memberships. Os
 * vínculos são os que o BANCO devolve para este usuário — é o que faz o teste do
 * header forjado valer: pedir o tenant B não coloca o B nesta lista.
 */
function comUsuarioEVinculos(usuario: { id: string; email: string } | null, vinculos: Vinculo[]) {
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    then: (resolver: (r: { data: Vinculo[]; error: null }) => unknown) => resolver({ data: vinculos, error: null }),
  }

  vi.mocked(criarClienteDoUsuario).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: usuario }, error: usuario ? null : { message: 'sem sessão' } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1' } }) },
    },
    from: () => consulta,
  } as unknown as Awaited<ReturnType<typeof criarClienteDoUsuario>>)
}

function comCookie(valor: string | null) {
  vi.mocked(cookies).mockResolvedValue({
    get: (nome: string) => (valor && nome === 'ciclo_tenant' ? { name: nome, value: valor } : undefined),
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://app.ciclo.test/api/v1/clients', { headers })
}

const USUARIO = { id: 'u-1', email: 'bruna@salao.test' }

describe('resolução do tenant ativo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('usa o tenant do header quando existe membership ativo', async () => {
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'owner')])
    comCookie(null)

    const ctx = await contextoAtual(req({ 'x-tenant-id': TENANT_A }))
    expect(ctx).toMatchObject({ tenantId: TENANT_A, papel: 'owner' })
  })

  it('cai para o cookie quando não vem header', async () => {
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'manager')])
    comCookie(TENANT_A)

    expect(await contextoAtual(req())).toMatchObject({ tenantId: TENANT_A, papel: 'manager' })
  })

  it('header forjado de outro tenant devolve TENANT_MISMATCH', async () => {
    // O banco só devolve o vínculo com A; pedir B é exatamente o ataque.
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'owner')])
    comCookie(null)

    await expect(contextoAtual(req({ 'x-tenant-id': TENANT_B }))).rejects.toMatchObject({
      code: 'TENANT_MISMATCH',
      status: 403,
    })
  })

  it('cookie forjado também não passa — a revalidação não olha a origem', async () => {
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'owner')])
    comCookie(TENANT_B)

    await expect(contextoAtual(req())).rejects.toMatchObject({ code: 'TENANT_MISMATCH' })
  })

  it('header que nem uuid é leva o mesmo erro, sem ir ao banco', async () => {
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'owner')])
    comCookie(null)

    await expect(contextoAtual(req({ 'x-tenant-id': "' or 1=1 --" }))).rejects.toMatchObject({
      code: 'TENANT_MISMATCH',
    })
  })

  it('sem header e sem cookie, com um vínculo só, assume esse', async () => {
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'professional')])
    comCookie(null)

    expect(await contextoAtual(req())).toMatchObject({ tenantId: TENANT_A, papel: 'professional' })
  })

  it('sem escolha e com dois vínculos, pede para escolher', async () => {
    comUsuarioEVinculos(USUARIO, [
      vinculo(TENANT_A, 'professional'),
      vinculo(TENANT_B, 'professional'),
    ])
    comCookie(null)

    await expect(contextoAtual(req())).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('conta sem nenhum estabelecimento é mandada para o cadastro', async () => {
    comUsuarioEVinculos(USUARIO, [])
    comCookie(null)

    await expect(contextoAtual(req())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('sem sessão, o tenant nem é resolvido', async () => {
    comUsuarioEVinculos(null, [])
    comCookie(TENANT_A)

    await expect(contextoAtual(req({ 'x-tenant-id': TENANT_A }))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    })
  })
})

describe('no envelope da rota', () => {
  afterEach(() => vi.restoreAllMocks())

  it('o TENANT_MISMATCH sai como 403 e sem dado do outro tenant', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    comUsuarioEVinculos(USUARIO, [vinculo(TENANT_A, 'owner')])
    comCookie(null)

    const handler = rota(async (r: Request) => {
      const ctx = await contextoAtual(r)
      return { tenantId: ctx.tenantId }
    })
    const resposta = await handler(req({ 'x-tenant-id': TENANT_B }), undefined)

    expect(resposta.status).toBe(403)
    const texto = await resposta.text()
    expect(JSON.parse(texto)).toMatchObject({ error: { code: 'TENANT_MISMATCH' } })
    expect(texto).not.toContain(TENANT_A)
  })
})
