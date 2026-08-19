import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaCampanha, registrarCampanha } from '@/server/services/crm'

export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const entrada = await lerCorpo(req, EsquemaCampanha)
  const db = await criarClienteDoUsuario()

  const campanha = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/campaigns' }, () =>
    registrarCampanha(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'campaign.create',
      entity: 'campaigns',
      entityId: campanha.id,
      after: campanha,
      requestId,
    },
    req,
  )

  return campanha
})
