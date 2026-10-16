import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { comIdempotencia } from '@/server/http/idempotency'
import { contextoDeReautenticacao, senhaConfere } from '@/server/auth/session'
import { excluirPropriaConta } from '@/server/services/conta'

import { DELETE as excluir, GET as conferir } from '@/app/api/v1/account/route'

vi.mock('@/server/auth/session', () => ({ contextoDeReautenticacao: vi.fn(), senhaConfere: vi.fn() }))
vi.mock('@/server/db/with-tenant', () => ({ withNovoTenant: vi.fn(async (fn: (svc: unknown) => unknown) => fn({})) }))
vi.mock('@/server/services/conta', () => ({
  situacaoDaConta: vi.fn(async () => ({ vinculos: [{ tenantId: 't-1', role: 'owner' }], bloqueios: [] })),
  excluirPropriaConta: vi.fn(async () => [{ tenantId: 't-1', role: 'owner' }]),
}))
vi.mock('@/server/audit/write', () => ({ writeAudit: vi.fn(async () => undefined) }))
vi.mock('@/server/http/idempotency', () => ({ comIdempotencia: vi.fn(async (_req: Request, _o: unknown, fn: () => unknown) => fn()) }))
vi.mock('@/server/services/rate-limit', () => ({ limitador: vi.fn(async () => ({ permitido: true })) }))

/**
 * docs/98-aprimoramento/11 LOJA-27. A rota exigia `aal2` nos dois métodos. Medido lendo o código em 15/10: sem
 * verificação em duas etapas, o GET devolvia `MFA_REQUIRED`, a tela lia `data` vazio e mostrava "Não consegui
 * verificar sua conta agora. Confira a conexão" (erro falso); o DELETE mandava ligar a verificação antes de sair.
 */
const SESSAO = { userId: 'u-1', email: 'ana@salao.test', aal: 'aal1', metodos: ['password'] }
const AGORA = Date.now()

function contexto(c: { aal?: string; temSegundoFator?: boolean; temSenha?: boolean; minutosDesdeOLogin?: number }) {
  vi.mocked(contextoDeReautenticacao).mockResolvedValue({
    sessao: { ...SESSAO, aal: c.aal ?? 'aal1' },
    temSegundoFator: c.temSegundoFator ?? false,
    temSenha: c.temSenha ?? true,
    autenticadoEmMs: AGORA - (c.minutosDesdeOLogin ?? 60) * 60 * 1000,
  })
}

function del(corpo?: unknown) {
  return excluir(
    new Request('https://app.ciclo.test/api/v1/account', {
      method: 'DELETE',
      headers: { 'idempotency-key': crypto.randomUUID(), ...(corpo ? { 'content-type': 'application/json' } : {}) },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    }),
    undefined,
  )
}

async function corpoDe(r: Response) {
  return (await r.json()) as { data?: { confirmacao?: string; deleted?: boolean }; error?: { code: string; details?: { fields?: Record<string, string> } } }
}

describe('excluir a própria conta sem exigir o segundo fator de quem não tem', () => {
  beforeEach(() => vi.mocked(senhaConfere).mockResolvedValue(false))
  afterEach(() => vi.clearAllMocks())

  it('GET responde para quem não tem segundo fator, e diz qual confirmação a tela vai pedir', async () => {
    contexto({})
    const r = await conferir(new Request('https://app.ciclo.test/api/v1/account'), undefined)
    expect(r.status).toBe(200)
    expect((await corpoDe(r)).data?.confirmacao).toBe('senha')
  })

  it('login de agora há pouco basta: exclui sem senha e sem segundo fator', async () => {
    contexto({ minutosDesdeOLogin: 2 })
    const r = await del()
    expect(r.status).toBe(200)
    expect(excluirPropriaConta).toHaveBeenCalledOnce()
  })

  it('login antigo: com a senha certa exclui', async () => {
    contexto({})
    vi.mocked(senhaConfere).mockResolvedValue(true)
    const r = await del({ password: 'a-senha-certa-123' })
    expect(r.status).toBe(200)
    expect(senhaConfere).toHaveBeenCalledWith('ana@salao.test', 'a-senha-certa-123')
    expect(excluirPropriaConta).toHaveBeenCalledOnce()
  })

  it('login antigo: senha errada não exclui e volta para o campo', async () => {
    contexto({})
    const r = await del({ password: 'errada' })
    expect(r.status).toBe(422)
    expect((await corpoDe(r)).error?.details?.fields?.password).toBeDefined()
    expect(excluirPropriaConta).not.toHaveBeenCalled()
  })

  it('login antigo sem senha nenhuma: pede reautenticação, não exclui', async () => {
    contexto({})
    const r = await del()
    expect((await corpoDe(r)).error?.code).toBe('REAUTH_REQUIRED')
    expect(excluirPropriaConta).not.toHaveBeenCalled()
  })

  it('quem cadastrou o segundo fator continua precisando dele, mesmo com a senha', async () => {
    contexto({ temSegundoFator: true, minutosDesdeOLogin: 1 })
    vi.mocked(senhaConfere).mockResolvedValue(true)
    const r = await del({ password: 'a-senha-certa-123' })
    expect((await corpoDe(r)).error?.code).toBe('MFA_REQUIRED')
    expect(excluirPropriaConta).not.toHaveBeenCalled()
  })

  it('a senha não entra no hash de idempotência (ele fica gravado no banco)', async () => {
    contexto({})
    vi.mocked(senhaConfere).mockResolvedValue(true)
    await del({ password: 'a-senha-certa-123' })
    const req = vi.mocked(comIdempotencia).mock.calls[0]![0]
    expect(await req.clone().text()).not.toContain('a-senha-certa-123')
  })
})
