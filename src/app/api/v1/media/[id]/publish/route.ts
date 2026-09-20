import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { despublicarDoPortfolio } from '@/server/services/portfolio'
import { publicarNoPortfolio } from '@/server/services/portfolio-upload'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

/** `POST /media/:id/publish` — copia a foto (privada) pro bucket público `vitrine`, se autorizada. */
export const POST = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa foto não existe mais.' })

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/media/${id}/publish` }, () =>
    publicarNoPortfolio(ctx.tenantId, id),
  )
})

/** `DELETE /media/:id/publish` — tira do site (a foto original em `media` continua intacta). */
export const DELETE = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa foto não existe mais.' })

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/media/${id}/publish` }, async () => {
    await despublicarDoPortfolio(ctx.tenantId, id)
    return { despublicada: true }
  })
})
