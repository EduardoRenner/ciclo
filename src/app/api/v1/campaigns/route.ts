import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { exigirModulo } from '@/server/services/planos'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaCampanha, registrarCampanha } from '@/server/services/crm'

export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const entrada = await lerCorpo(req, EsquemaCampanha)
  const db = await criarClienteDoUsuario()

  // §L.2.1: o módulo vale no SERVIDOR, e só na ESCRITA. Ler continua liberado de propósito
  // (regra 5.1, inviolável): cair de plano limita o que dá para FAZER, e nunca esconde o que
  // já existe. Quem desce de degrau continua vendo o que registrou — o que trava é criar mais.
  await exigirModulo(db, ctx.tenantId, 'campaigns')

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
