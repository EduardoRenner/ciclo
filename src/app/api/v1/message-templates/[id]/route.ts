import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { atualizarModelo, EsquemaModeloParcial, removerModelo } from '@/server/services/mensagens-prontas'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse modelo não existe mais.' })
  return id
}

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaModeloParcial)
  const db = await criarClienteDoUsuario()

  const modelo = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/message-templates/${id}` }, () =>
    atualizarModelo(db, ctx.tenantId, id, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'message_template.update',
      entity: 'message_templates',
      entityId: id,
      after: modelo,
      requestId,
    },
    req,
  )

  return modelo
})

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/message-templates/${id}` }, () =>
    removerModelo(db, ctx.tenantId, id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'message_template.delete',
      entity: 'message_templates',
      entityId: id,
      requestId,
    },
    req,
  )

  return resultado
})
