import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { cancelarExperimento } from '@/server/services/experimentos'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

/** Cancelar é UPDATE de `canceled_at` — teste não se apaga (migration 0098). */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse teste não está mais na sua lista.' })
  const db = await criarClienteDoUsuario()

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/experiments/${id}/cancel` }, async () => {
    const resultado = await cancelarExperimento(db, ctx.tenantId, id)
    if (resultado.cancelado) {
      await writeAudit(
        { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'experiment.cancel', entity: 'experiments', entityId: id, requestId },
        req,
      )
    }
    return resultado
  })
})
