import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { confirmarAgendamento } from '@/server/services/agendamentos'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
