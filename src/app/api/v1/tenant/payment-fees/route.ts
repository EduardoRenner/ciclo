import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { atualizarTaxasDePagamento, EsquemaTaxasDePagamento, lerTaxasDoTenant } from '@/server/services/taxas-de-pagamento'

/** Regra do negócio, não cadastro — `tenant:update`, só dono, igual ao resto de `/tenant`. */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const db = await criarClienteDoUsuario()
  return lerTaxasDoTenant(db, ctx.tenantId)
})

export const PATCH = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaTaxasDePagamento)
  const db = await criarClienteDoUsuario()
  const taxas = await atualizarTaxasDePagamento(db, ctx.tenantId, entrada)

  // Muda quanto o sistema diz que sobrou de toda comanda futura — mudança de regra de dinheiro
  // entra na trilha, como a de comissão.
  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'tenant.payment_fees', entity: 'tenants', entityId: ctx.tenantId, after: taxas, requestId },
    req,
  )

  return taxas
})
