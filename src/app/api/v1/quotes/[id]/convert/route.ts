import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { converterOrcamentoEmAgendamento, EsquemaConverterOrcamento } from '@/server/services/orcamentos'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse orçamento não existe mais.' })
  return id
}

/**
 * Registra o vínculo orçamento→agendamento (`quotes.converted_appointment_id`, reservado desde
 * P8 e nunca usado) — o agendamento em si já foi criado pela tela normal antes de chegar aqui.
 */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:create')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaConverterOrcamento)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/quotes/${id}/convert` }, () =>
    converterOrcamentoEmAgendamento(db, ctx.tenantId, id, entrada.appointmentId),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'quote.convert',
      entity: 'quotes',
      entityId: id,
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
