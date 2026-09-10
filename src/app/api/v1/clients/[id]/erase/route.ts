import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { withTenant } from '@/server/db/with-tenant'
import { eliminarCliente } from '@/server/services/lgpd'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * §2.7 `POST .../erase 🔐 anonimiza; mantém o que a lei exige`.
 *
 * `withTenant` (service_role) para a eliminação em si, DEPOIS de `client:delete` + `exigirAal2()`
 * já terem gate a rota. É o mesmo cliente que o job noturno (`lgpd-retention`) usa, e o mesmo
 * desenho da `0077` para leitura privilegiada: a permissão é checada na rota, a operação roda como
 * service_role. Até 2026-09-09 esta rota passava o cliente de SESSÃO, e a RLS `_tenant_all` deixava
 * — mas o lote 2.3 de RLS (`docs/58`) vai apertar `health_records`/`consents`/`client_notes`, e o
 * erase pelo cliente de sessão viraria `rowsRemoved: 0` com HTTP 200: o direito ao esquecimento
 * falhando em silêncio. Com service_role, o aperto da RLS não alcança o erase.
 */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:delete')
  const sessao = await exigirAal2()

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/erase` }, () =>
    withTenant(ctx.tenantId, (svc) => eliminarCliente(svc, ctx.tenantId, id)),
  )

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: sessao.userId, actorRole: ctx.papel, action: 'client.erase', entity: 'clients', entityId: id, after: resultado, requestId },
    req,
  )

  return resultado
})
