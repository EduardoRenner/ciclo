import { ipDe } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { urlAssinadaMedia } from '@/server/services/media'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** `GET /media/:id/url → signed URL 5 min (registra acesso)` (§2.7). */
export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa foto não existe mais.' })

  return urlAssinadaMedia(ctx.tenantId, id, {
    actorId: ctx.sessao.userId,
    ip: ipDe(req),
    userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
  })
})
