import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaFichaDeConsumo, listarFicha, salvarFicha } from '@/server/services/ficha-de-consumo'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse serviço não está mais no seu catálogo.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:read')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()
  return listarFicha(db, ctx.tenantId, id)
})

/** `PUT` e não `PATCH`: a ficha é substituída inteira. Ver `salvarFicha`. */
export const PUT = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaFichaDeConsumo)
  const db = await criarClienteDoUsuario()

  const antes = await listarFicha(db, ctx.tenantId, id)
  const ficha = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/services/${id}/consumption` }, () =>
    salvarFicha(db, ctx.tenantId, id, entrada),
  )

  // Mudar a ficha muda o custo de todo atendimento futuro daquele serviço e o que sai do estoque.
  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'service.consumption', entity: 'services', entityId: id, before: antes, after: ficha, requestId },
    req,
  )

  return ficha
})
