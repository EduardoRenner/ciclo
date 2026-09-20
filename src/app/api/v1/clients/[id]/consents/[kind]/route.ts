import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { revogarConsentimento, TIPOS_CONSENTIMENTO_CLIENTE } from '@/server/services/consentimentos'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string; kind: string }> }

export const DELETE = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const { id, kind } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  if (!(TIPOS_CONSENTIMENTO_CLIENTE as readonly string[]).includes(kind)) {
    throw AppError.validacao({ kind: 'Tipo de consentimento inválido.' })
  }

  const db = await criarClienteDoUsuario()
  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/consents/${kind}` }, () =>
    revogarConsentimento(db, ctx.tenantId, id, kind as (typeof TIPOS_CONSENTIMENTO_CLIENTE)[number]),
  )
})
