import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { cancelarSerie } from '@/server/services/recorrencia'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa série não existe mais.' })
  return id
}

/**
 * Cancelar a série ≠ cancelar um agendamento (§12) — por isso é um endpoint próprio, não o
 * DELETE de /appointments/[id]. Cancela o contrato e as ocorrências futuras ainda pendentes;
 * ocorrências passadas (já concluídas ou já canceladas individualmente) ficam intactas.
 */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:delete')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/appointments/series/${id}/cancel` }, () =>
    cancelarSerie(db, ctx.tenantId, id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'appointment_series.cancel',
      entity: 'appointment_series',
      entityId: id,
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
