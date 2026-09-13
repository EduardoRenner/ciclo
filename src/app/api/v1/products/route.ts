import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarProduto, EsquemaProduto } from '@/server/services/estoque'

/**
 * docs/62 Fase 1: não existia rota para cadastrar produto novo — só o pacote inicial do nicho
 * semeava a tabela, e depois disso não havia caminho nenhum. `POST /api/v1/products` é o
 * alicerce: sem ele, nem o estoque nem a comanda têm produto de revenda para mostrar.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'inventory:create')

  const entrada = await lerCorpo(req, EsquemaProduto)
  const db = await criarClienteDoUsuario()

  const produto = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/products' }, () =>
    criarProduto(db, ctx.tenantId, entrada),
  )

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
