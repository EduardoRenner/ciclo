import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { entrarNaLista, EsquemaEntrarListaEspera, listarListaEspera } from '@/server/services/lista-espera'

export const GET = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:read')

  const serviceId = new URL(req.url).searchParams.get('serviceId') ?? undefined
  const db = await criarClienteDoUsuario()
  return { waitlist: await listarListaEspera(db, ctx.tenantId, serviceId) }
})

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:create')

  const entrada = await lerCorpo(req, EsquemaEntrarListaEspera)
  const db = await criarClienteDoUsuario()

  const item = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/waitlist' }, () =>
    entrarNaLista(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'waitlist.create', entity: 'waitlist', entityId: item.id, requestId },
    req,
  )

  return item
})
