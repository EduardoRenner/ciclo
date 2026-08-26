import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { atualizarConfigFidelidade, EsquemaConfigFidelidade, lerConfigFidelidade } from '@/server/services/fidelidade'
import { exigirModulo } from '@/server/services/planos'

/** Regra do negócio, não cadastro de cliente — `tenant:update`, só dono, igual ao resto de `/tenant`. */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const db = await criarClienteDoUsuario()
  const { data } = await db.from('tenants').select('settings').eq('id', ctx.tenantId).single()
  return lerConfigFidelidade(data?.settings)
})

export const PATCH = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaConfigFidelidade)
  const db = await criarClienteDoUsuario()

  // §L.2.1: aqui, não em `clients/[id]/loyalty`, é onde a fidelidade automática é LIGADA
  // (`pointsPerReal > 0`) — a partir daí `pontuarAtendimentoConcluido` pontua sozinho em todo
  // atendimento concluído, sem passar por nenhuma rota de escrita de novo. Travar só o lançamento
  // manual deixaria a automação de graça, que é o produto de verdade que o degrau Equipe vende.
  await exigirModulo(db, ctx.tenantId, 'loyalty')

  const config = await atualizarConfigFidelidade(db, ctx.tenantId, entrada)

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.loyalty_config',
      entity: 'tenants',
      entityId: ctx.tenantId,
      after: config,
      requestId,
    },
    req,
  )

  return config
})
