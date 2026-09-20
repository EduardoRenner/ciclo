import { ipDe } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { EsquemaRegistrarConsentimento, registrarConsentimento, statusConsentimentos } from '@/server/services/consentimentos'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()
  return statusConsentimentos(db, ctx.tenantId, id)
})

export const POST = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaRegistrarConsentimento)
  const db = await criarClienteDoUsuario()

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/consents` }, () =>
    registrarConsentimento(db, ctx.tenantId, id, entrada, {
      ip: ipDe(req),
      userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
    }),
  )
})
