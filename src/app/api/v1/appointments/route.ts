import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { criarAgendamento, EsquemaCriarAgendamento, listarAgendamentos } from '@/server/services/agendamentos'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:read')

  const params = new URL(req.url).searchParams
  const db = await criarClienteDoUsuario()

  const appointments = await listarAgendamentos(db, ctx.tenantId, {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    professionalId: params.get('professionalId') ?? undefined,
    status: params.get('status') ?? undefined,
  })

  return { appointments }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:create')

  const entrada = await lerCorpo(req, EsquemaCriarAgendamento)
  const db = await criarClienteDoUsuario()

  const { data: tenantRow } = await db.from('tenants').select('settings, timezone').eq('id', ctx.tenantId).single()

  const agendamento = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/appointments' }, () =>
    criarAgendamento(db, ctx.tenantId, tenantRow?.timezone ?? 'America/Sao_Paulo', ctx.sessao.userId, entrada, tenantRow?.settings),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'appointment.create',
      entity: 'appointments',
      entityId: agendamento.id,
      after: agendamento,
      requestId,
    },
    req,
  )

  return { appointment: agendamento }
})
