import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { removerFolga } from '@/server/services/folgas'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa folga não existe mais.' })

  const db = await criarClienteDoUsuario()
  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/time-off/${id}` }, () =>
    removerFolga(db, ctx.tenantId, id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'time_off.delete',
      entity: 'time_off',
      entityId: id,
      requestId,
    },
    req,
  )

  return resultado
})
