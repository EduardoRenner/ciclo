import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { atualizarTenant, EsquemaTenant, lerTenant } from '@/server/services/site'

/**
 * Não existia nenhuma tela nem rota que editasse o próprio tenant — só o
 * onboarding insere (achado na auditoria pré-`/admin`). `tenant:update` não
 * está na tabela de `PERMISSIONS` nenhuma além do curinga do `owner`, então
 * `exigirPermissao` já restringe a só dono sozinha — igual à política de RLS
 * `tenants_update`, que já existia antes desta rota (segunda camada).
 */
export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const db = await criarClienteDoUsuario()
  return lerTenant(db, ctx.tenantId)
})

export const PATCH = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const entrada = await lerCorpo(req, EsquemaTenant)
  const db = await criarClienteDoUsuario()

  const antes = await lerTenant(db, ctx.tenantId)

  const tenant = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/tenant' }, () =>
    atualizarTenant(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.update',
      entity: 'tenants',
      entityId: ctx.tenantId,
      before: antes,
      after: tenant,
      requestId,
    },
    req,
  )

  return tenant
})
