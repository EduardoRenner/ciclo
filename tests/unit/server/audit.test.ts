import { afterEach, describe, expect, it, vi } from 'vitest'

import { writeAudit } from '@/server/audit/write'
import { withTenant } from '@/server/db/with-tenant'

vi.mock('@/server/db/with-tenant', () => ({ withTenant: vi.fn() }))

const TENANT = '11111111-1111-4111-8111-111111111111'

/** Captura a linha que teria ido para `audit_log`. */
function capturar() {
  const linhas: Record<string, unknown>[] = []

  vi.mocked(withTenant).mockImplementation(async (tenantId, fn) => {
    const db = {
      from: () => ({
        insert: async (linha: Record<string, unknown>) => {
          linhas.push(linha)
          return { error: null }
        },
      }),
    }
    return fn(db as never, tenantId)
  })

  return linhas
}

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://app.ciclo.test/api/v1/clients', { method: 'POST', headers })
}

const BASE = {
  tenantId: TENANT,
  actorId: 'u-1',
  actorRole: 'owner' as const,
  action: 'client.update',
  requestId: 'req_abc12345',
}

describe('writeAudit', () => {
  afterEach(() => vi.restoreAllMocks())

  it('grava actor, ação, request e o antes/depois', async () => {
    const linhas = capturar()
    await writeAudit({ ...BASE, entity: 'clients', before: { name: 'Ana' }, after: { name: 'Ana Paula' } }, req())

    expect(linhas[0]).toMatchObject({
      tenant_id: TENANT,
      actor_id: 'u-1',
      actor_role: 'owner',
      action: 'client.update',
      entity: 'clients',
      before: { name: 'Ana' },
      after: { name: 'Ana Paula' },
      request_id: 'req_abc12345',
    })
  })

  it('pega o IP da pessoa, não o do proxy', async () => {
    const linhas = capturar()
    await writeAudit(BASE, req({ 'x-forwarded-for': '201.10.0.7, 10.0.0.1, 10.0.0.2' }))
    expect(linhas[0]?.ip).toBe('201.10.0.7')
  })

  it('redige dado de saúde e segredo, em qualquer profundidade', async () => {
    const linhas = capturar()
    await writeAudit(
      {
        ...BASE,
        action: 'vault.update',
        after: {
          form_key: 'lashes_v1',
          ciphertext: 'AAAA',
          answers: { alergia: 'sim, a resina' },
          meta: { nested: { password: 'hunter2', ok: 'pode ficar' } },
        },
      },
      req(),
    )

    const texto = JSON.stringify(linhas[0]?.after)
    expect(texto).not.toContain('resina')
    expect(texto).not.toContain('hunter2')
    expect(texto).not.toContain('AAAA')
    expect(texto).toContain('pode ficar')
    expect(texto).toContain('lashes_v1')
  })

  it('não deixa a falha da trilha derrubar a operação já concluída', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(withTenant).mockRejectedValue(new Error('banco fora do ar'))

    // A pessoa já criou o agendamento; estourar aqui mostraria erro para uma
    // operação que deu certo.
    await expect(writeAudit(BASE, req())).resolves.toBeUndefined()
    expect(String(erro.mock.calls[0]?.[0])).toContain('audit_falhou')
  })

  it('recusa do banco NÃO passa em silêncio — vira o mesmo alarme no log', async () => {
    /*
     * `.insert()` do supabase-js devolve `{ error }` em vez de lançar. Antes desta guarda, uma
     * recusa do Postgres (tipo errado numa coluna, RLS, constraint) sumia sem nem o log: a
     * trilha simplesmente não era escrita e ninguém ficava sabendo.
     *
     * Descoberto ao auditar a rota de módulos, que mandava a chave do módulo ('campaigns') para
     * `audit_log.entity_id`, que é `uuid`. Os tipos gerados dizem `string` e deixam passar.
     */
    const alarme = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(withTenant).mockImplementation(async (tenantId, fn) => {
      const db = { from: () => ({ insert: async () => ({ error: { message: 'invalid input syntax for type uuid' } }) }) }
      return fn(db as never, tenantId)
    })

    // A operação da pessoa continua concluída — o que muda é que agora alguém consegue reagir.
    await expect(writeAudit(BASE, req())).resolves.toBeUndefined()
    expect(String(alarme.mock.calls[0]?.[0])).toContain('audit_falhou')
    alarme.mockRestore()
  })

  it('corta user-agent gigante antes de gravar', async () => {
    const linhas = capturar()
    await writeAudit(BASE, req({ 'user-agent': 'x'.repeat(5000) }))
    expect(String(linhas[0]?.user_agent)).toHaveLength(400)
  })
})
