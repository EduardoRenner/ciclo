import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { eliminarCliente } from '@/server/services/lgpd'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** §2.7 `POST .../erase 🔐 anonimiza; mantém o que a lei exige`. */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:delete')
  const sessao = await exigirAal2()

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })

  const db = await criarClienteDoUsuario()
  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/erase` }, () => eliminarCliente(db, ctx.tenantId, id))

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: sessao.userId, actorRole: ctx.papel, action: 'client.erase', entity: 'clients', entityId: id, after: resultado, requestId },
    req,
  )

  return resultado
})
