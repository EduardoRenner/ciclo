import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { atualizarDescontoEGorjeta, buscarComanda, EsquemaDescontoGorjeta } from '@/server/services/comanda'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function ticketIdDaRota(params: unknown): Promise<string> {
  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa comanda não existe mais.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const id = await ticketIdDaRota(params)
  const db = await criarClienteDoUsuario()
  return buscarComanda(db, ctx.tenantId, id)
})

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const id = await ticketIdDaRota(params)
  const entrada = await lerCorpo(req, EsquemaDescontoGorjeta)
  const db = await criarClienteDoUsuario()

  await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/tickets/${id}` }, () => atualizarDescontoEGorjeta(db, ctx.tenantId, id, entrada))

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'ticket.update', entity: 'tickets', entityId: id, after: entrada, requestId },
    req,
  )

  return buscarComanda(db, ctx.tenantId, id)
})
