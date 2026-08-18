import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { arquivarServico, atualizarServico, EsquemaServicoParcial, listarServicos } from '@/server/services/servicos'

type Ctx = { params: Promise<{ id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  // Id malformado é 404, não 500: quem chuta uuid não descobre se existe.
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse serviço não está mais no seu catálogo.' })
  return id
}

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaServicoParcial)
  const db = await criarClienteDoUsuario()

  // O "antes" é para a trilha: sem ele a auditoria mostra o novo valor sem o
  // que havia lá, e não dá para reconstruir quem mudou o preço de quanto.
  const antes = (await listarServicos(db, ctx.tenantId, true)).find((s) => s.id === id) ?? null

  const servico = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/services/${id}` },
    () => atualizarServico(db, ctx.tenantId, id, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'service.update',
      entity: 'services',
      entityId: id,
      before: antes,
      after: servico,
      requestId,
    },
    req,
  )

  return servico
})

export const DELETE = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:delete')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/services/${id}` },
    () => arquivarServico(db, ctx.tenantId, id),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'service.archive',
      entity: 'services',
      entityId: id,
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
