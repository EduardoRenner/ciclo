import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarPessoa, EsquemaPessoa } from '@/server/advocacia/estrutura-escrita'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/** docs/101 T2.1: pessoa da família de um cliente (sem documento: o CPF, quando houver, entra só como hash). */
export const POST = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:create')

  const entrada = await lerCorpo(req, EsquemaPessoa)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_structure')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/persons' }, async () => {
    const r = await criarPessoa(db, ctx.tenantId, ctx.sessao.userId, entrada)
    await writeAudit(
      { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'legal_person.create', entity: 'legal_persons', entityId: r.id, after: { vinculo: entrada.relationship }, requestId },
      req,
    )
    return r
  })
})
