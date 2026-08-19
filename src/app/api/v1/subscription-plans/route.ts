import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarPlano, EsquemaPlano, listarPlanos } from '@/server/services/fidelidade'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const db = await criarClienteDoUsuario()
  return { plans: await listarPlanos(db, ctx.tenantId) }
})

/** Plano é preço do negócio, não cadastro de cliente — por isso `service:update`, como serviço. */
export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:update')

  const entrada = await lerCorpo(req, EsquemaPlano)
  const db = await criarClienteDoUsuario()

  const plano = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/subscription-plans' }, () =>
    criarPlano(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'subscription_plan.create',
      entity: 'subscription_plans',
      entityId: plano.id,
      after: plano,
      requestId,
    },
    req,
  )

  return plano
})
