import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { removerItemComanda } from '@/server/services/comanda'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ id: string; itemId: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const { id: ticketId, itemId } = await (params as Ctx).params
  if (!UUID.test(ticketId) || !UUID.test(itemId)) throw new AppError('NOT_FOUND', { message: 'Esse item não existe mais.' })

  const db = await criarClienteDoUsuario()
  await removerItemComanda(db, ctx.tenantId, ticketId, itemId)

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'ticket.item.remove', entity: 'ticket_items', entityId: itemId, requestId },
    req,
  )

  return { removed: true }
})
