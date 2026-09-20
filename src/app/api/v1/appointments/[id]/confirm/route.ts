import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { confirmarAgendamento } from '@/server/services/agendamentos'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })
  const db = await criarClienteDoUsuario()

  const agendamento = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/appointments/${id}/confirm` }, () =>
    confirmarAgendamento(db, ctx.tenantId, id),
  )

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'appointment.confirm', entity: 'appointments', entityId: id, after: agendamento, requestId },
    req,
  )

  return { appointment: agendamento }
})
