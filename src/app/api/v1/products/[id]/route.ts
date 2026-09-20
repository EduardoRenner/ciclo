import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { atualizarProduto, EsquemaProdutoParcial } from '@/server/services/estoque'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }


async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  // Id malformado é 404, não 500: quem chuta uuid não descobre se existe. Mesmo padrão de services/[id].
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse produto não está mais no seu estoque.' })
  return id
}

export const PATCH = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'inventory:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaProdutoParcial)
  const db = await criarClienteDoUsuario()

  const produto = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/products/${id}` }, () =>
    atualizarProduto(db, ctx.tenantId, id, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'product.update',
      entity: 'products',
      entityId: id,
      after: produto,
      requestId,
    },
    req,
  )

  return produto
})
