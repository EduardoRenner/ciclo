import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'
import { EsquemaVendaDeProduto, venderProduto } from '@/server/services/venda-de-produto'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

/** Venda de balcão: abre a comanda, lança o produto no nome de quem vendeu e fecha. */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse produto não está mais no seu estoque.' })

  const entrada = await lerCorpo(req, EsquemaVendaDeProduto)
  const db = await criarClienteDoUsuario()

  // Mesmo módulo de "lançar item na comanda" (`tickets/[id]/items`): vender produto é usar a
  // comanda como caixa, e é só isso que o plano trava.
  await exigirModulo(db, ctx.tenantId, 'register')

  // BL-42: `writeAudit` dentro do fechamento — ver o comentário em `wallet/credit/route.ts`.
  const venda = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/products/${id}/sale` }, async () => {
    const venda = await venderProduto(db, ctx.tenantId, id, entrada)
    await writeAudit(
      { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'product.sale', entity: 'tickets', entityId: venda.ticketId, after: venda, requestId },
      req,
    )
    return venda
  })

  return venda
})
