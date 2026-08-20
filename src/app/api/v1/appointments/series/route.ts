import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { criarSerie, EsquemaCriarSerie } from '@/server/services/recorrencia'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:create')

  const entrada = await lerCorpo(req, EsquemaCriarSerie)
  const db = await criarClienteDoUsuario()

  const { data: tenantRow } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).single()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/appointments/series' }, () =>
    criarSerie(db, ctx.tenantId, tenantRow?.timezone ?? 'America/Sao_Paulo', ctx.sessao.userId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'appointment_series.create',
      entity: 'appointment_series',
      entityId: resultado.serie.id,
      after: resultado.serie,
      requestId,
    },
    req,
  )

  return { series: resultado.serie, occurrences: resultado.ocorrencias }
})
