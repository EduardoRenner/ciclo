import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { definirExpediente, EsquemaExpediente, listarExpediente } from '@/server/services/expediente'
import { exigirModulo } from '@/server/services/planos'

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

  /*
   * "Agenda por profissional" é o que o cartão do Equipe vende (`planos-cartoes.ts`), e é
   * exatamente esta rota quando vem um uuid. O expediente `default` (professional_id nulo) é o
   * horário do próprio negócio: quem atende sozinho precisa dele para existir, e travá-lo
   * cobraria pelo plano Equipe o direito de dizer que horas o salão abre.
   *
   * Por isso a trava é condicional. Ela não duplica o teto numérico de `POST /professionals` —
   * aquele governa QUANTOS profissionais existem, este governa se cada um tem agenda própria.
   * Antes da idempotência, como toda trava desta base.
   */
  if (professionalId !== null) await exigirModulo(db, ctx.tenantId, 'team')

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
