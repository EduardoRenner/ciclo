import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { EsquemaCustoFixo, atualizarCustoFixo, lerCustoFixoDoTenant } from '@/server/services/custo-fixo'

/** Regra do negócio, não cadastro — `tenant:update`, só dono, igual ao resto de `/tenant`. */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const db = await criarClienteDoUsuario()
  return lerCustoFixoDoTenant(db, ctx.tenantId)
})

export const PATCH = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaCustoFixo)
  const db = await criarClienteDoUsuario()
  const custo = await atualizarCustoFixo(db, ctx.tenantId, entrada)

  // Muda quanto o sistema diz que sobrou de toda comanda futura — mesma trilha da taxa e da
  // comissão, pelo mesmo motivo.
  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'tenant.fixed_cost', entity: 'tenants', entityId: ctx.tenantId, after: custo, requestId },
    req,
  )

  return custo
})
