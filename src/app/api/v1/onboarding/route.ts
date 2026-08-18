import { exigirSessao } from '@/server/auth/session'
import { EsquemaOnboarding } from '@/server/auth/schemas'
import { withNovoTenant } from '@/server/db/with-tenant'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { writeAudit } from '@/server/audit/write'
import { executarOnboarding } from '@/server/services/onboarding'

export const POST = rota(async (req, _ctx, requestId) => {
  const sessao = await exigirSessao()
  const dados = await lerCorpo(req, EsquemaOnboarding)

  const { tenant } = await withNovoTenant((svc) => executarOnboarding(svc, { userId: sessao.userId, ...dados }))

  await writeAudit(
    {
      tenantId: tenant.id,
      actorId: sessao.userId,
      actorRole: 'owner',
      action: 'tenant.onboarding',
      entity: 'tenants',
      entityId: tenant.id,
      after: { name: tenant.name, slug: tenant.slug, vertical: tenant.vertical },
      requestId,
    },
    req,
  )

  return { tenant, role: 'owner' as const }
})
