import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { adicionarItemComanda, EsquemaItemComanda } from '@/server/services/comanda'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const { id: ticketId } = await (params as Ctx).params
  if (!UUID.test(ticketId)) throw new AppError('NOT_FOUND', { message: 'Essa comanda não existe mais.' })

  const entrada = await lerCorpo(req, EsquemaItemComanda)
  const db = await criarClienteDoUsuario()

  const item = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/tickets/${ticketId}/items` }, () =>
    adicionarItemComanda(db, ctx.tenantId, ticketId, entrada),
  )

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'ticket.item.add', entity: 'ticket_items', entityId: item.id, after: item, requestId },
    req,
  )

  return item
})
