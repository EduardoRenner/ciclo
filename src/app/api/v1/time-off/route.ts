import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { criarFolga, EsquemaFolga, listarFolgas } from '@/server/services/folgas'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:read')

  const professionalId = new URL(req.url).searchParams.get('professionalId') ?? undefined
  const db = await criarClienteDoUsuario()

  return { timeOff: await listarFolgas(db, ctx.tenantId, professionalId) }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:update')

  const entrada = await lerCorpo(req, EsquemaFolga)
  const db = await criarClienteDoUsuario()

  const folga = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/time-off' }, () =>
    criarFolga(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'time_off.create',
      entity: 'time_off',
      entityId: folga.id,
      after: folga,
      requestId,
    },
    req,
  )

  return folga
})
