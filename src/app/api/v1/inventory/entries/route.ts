import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { exigirModulo } from '@/server/services/planos'
import { EsquemaEntradaEstoque, registrarEntradaEstoque } from '@/server/services/estoque'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'inventory:create')

  const entrada = await lerCorpo(req, EsquemaEntradaEstoque)
  const db = await criarClienteDoUsuario()

  // §L.2.1: o módulo vale no SERVIDOR, e só na ESCRITA. Ler continua liberado de propósito
  // (regra 5.1, inviolável): cair de plano limita o que dá para FAZER, e nunca esconde o que
  // já existe. Quem desce de degrau continua vendo o que registrou — o que trava é criar mais.
  await exigirModulo(db, ctx.tenantId, 'stock')

  const produto = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/inventory/entries' }, () => registrarEntradaEstoque(db, ctx.tenantId, entrada))

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'inventory.entry', entity: 'products', entityId: entrada.productId, after: produto, requestId },
    req,
  )

  return produto
})
