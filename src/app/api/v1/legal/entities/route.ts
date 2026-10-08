import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarEmpresa, EsquemaEmpresa } from '@/server/advocacia/estrutura-escrita'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/** docs/101 T2.1: empresa da família (holding, operacional ou outra). */
export const POST = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:create')

  const entrada = await lerCorpo(req, EsquemaEmpresa)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_structure')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/entities' }, async () => {
    const r = await criarEmpresa(db, ctx.tenantId, entrada)
    await writeAudit(
      { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'legal_entity.create', entity: 'legal_entities', entityId: r.id, after: { tipo: entrada.kind }, requestId },
      req,
    )
    return r
  })
})
