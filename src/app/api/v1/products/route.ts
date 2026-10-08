import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarProduto, EsquemaProdutoNovo, registrarEntradaEstoque } from '@/server/services/estoque'

/**
 * docs/62 Fase 1: não existia rota para cadastrar produto novo — só o pacote inicial do nicho
 * semeava a tabela, e depois disso não havia caminho nenhum. `POST /api/v1/products` é o
 * alicerce: sem ele, nem o estoque nem a comanda têm produto de revenda para mostrar.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'inventory:create')

  const { initialQty, ...entrada } = await lerCorpo(req, EsquemaProdutoNovo)
  const db = await criarClienteDoUsuario()

  // BL-42: writeAudit dentro do fechamento — ver o comentário em wallet/credit/route.ts.
  const produto = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/products' }, async () => {
    let produto = await criarProduto(db, ctx.tenantId, entrada)
    // O estoque inicial entra como compra ao custo informado, pelo mesmo caminho da entrada manual: o
    // saldo e o histórico de movimento nascem juntos, e o custo médio parte do valor certo.
    if (initialQty > 0) {
      const comEstoque = await registrarEntradaEstoque(db, ctx.tenantId, {
        productId: produto.id,
        qty: initialQty,
        unitCostCents: entrada.avgCostCents,
        note: 'Estoque inicial',
      })
      produto = { ...produto, stock_qty: comEstoque.stock_qty, avg_cost_cents: comEstoque.avg_cost_cents }
    }
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'product.create',
        entity: 'products',
        entityId: produto.id,
        after: produto,
        requestId,
      },
      req,
    )
    return produto
  })

  return produto
})
