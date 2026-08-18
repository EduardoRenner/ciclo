import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { cancelarAgendamento, EsquemaCancelar, EsquemaRemarcar, remarcarAgendamento } from '@/server/services/agendamentos'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })
  return id
}

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaRemarcar)
  const db = await criarClienteDoUsuario()

  const { data: tenantRow } = await db.from('tenants').select('settings, timezone').eq('id', ctx.tenantId).single()

  const agendamento = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/appointments/${id}` }, () =>
    remarcarAgendamento(db, ctx.tenantId, tenantRow?.timezone ?? 'America/Sao_Paulo', id, entrada, tenantRow?.settings),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'appointment.reschedule',
      entity: 'appointments',
      entityId: id,
      after: agendamento,
      requestId,
    },
    req,
  )

  return { appointment: agendamento }
})

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:delete')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaCancelar)
  const db = await criarClienteDoUsuario()

  const agendamento = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/appointments/${id}` }, () =>
    cancelarAgendamento(db, ctx.tenantId, id, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'appointment.cancel',
      entity: 'appointments',
      entityId: id,
      after: agendamento,
      requestId,
    },
    req,
  )

  return { appointment: agendamento }
})
