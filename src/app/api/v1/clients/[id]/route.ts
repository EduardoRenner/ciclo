import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { atualizarCliente, buscarCliente, EsquemaClienteParcial, removerCliente } from '@/server/services/clientes'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()
  return buscarCliente(db, ctx.tenantId, id)
})

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaClienteParcial)
  const db = await criarClienteDoUsuario()

  const antes = await buscarCliente(db, ctx.tenantId, id)

  const cliente = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}` }, () =>
    atualizarCliente(db, ctx.tenantId, id, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'client.update',
      entity: 'clients',
      entityId: id,
      before: antes,
      after: cliente,
      requestId,
    },
    req,
  )

  return cliente
})

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:delete')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}` }, () =>
    removerCliente(db, ctx.tenantId, id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'client.delete',
      entity: 'clients',
      entityId: id,
      requestId,
    },
    req,
  )

  return resultado
})
