import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { deletarMedia } from '@/server/services/media'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

/** `DELETE /media/:id` — soft delete (regra 11 do CLAUDE.md), nunca apaga o arquivo do bucket. */
export const DELETE = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa foto não existe mais.' })

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/media/${id}` }, async () => {
    await deletarMedia(ctx.tenantId, id)
    return { deleted: true }
  })
})
