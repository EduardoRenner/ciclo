import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { EsquemaFechamento, fecharComanda } from '@/server/services/comanda'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const { id: ticketId } = await (params as Ctx).params
  if (!UUID.test(ticketId)) throw new AppError('NOT_FOUND', { message: 'Essa comanda não existe mais.' })

  const entrada = await lerCorpo(req, EsquemaFechamento)
  const db = await criarClienteDoUsuario()
  const ticket = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/tickets/${ticketId}/close` }, () =>
    fecharComanda(db, ctx.tenantId, ticketId, entrada.paymentMethod),
  )

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'ticket.close', entity: 'tickets', entityId: ticketId, after: ticket, requestId },
    req,
  )

  return ticket
})
