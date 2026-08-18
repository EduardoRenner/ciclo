import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { definirExpediente, EsquemaExpediente, listarExpediente } from '@/server/services/expediente'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** `default` na URL é o expediente padrão do tenant (professional_id nulo); qualquer outro valor precisa ser um uuid. */
async function professionalIdDaRota(ctx: unknown): Promise<string | null> {
  const { id } = await (ctx as Ctx).params
  if (id === 'default') return null
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse profissional não está mais no seu time.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:read')

  const professionalId = await professionalIdDaRota(params)
  const db = await criarClienteDoUsuario()

  return { businessHours: await listarExpediente(db, ctx.tenantId, professionalId) }
})

export const PUT = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'professional:update')

  const professionalId = await professionalIdDaRota(params)
  const corpo = await lerCorpo(req, EsquemaExpediente)
  if (corpo.professionalId !== professionalId) {
    throw AppError.validacao({ professionalId: 'O profissional do corpo não bate com o da URL.' })
  }

  const db = await criarClienteDoUsuario()
  const resultado = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: `/api/v1/professionals/${professionalId ?? 'default'}/business-hours` },
    () => definirExpediente(db, ctx.tenantId, corpo),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'business_hours.replace',
      entity: 'business_hours',
      entityId: professionalId ?? undefined,
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
