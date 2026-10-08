import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { EsquemaEncerrarPrazo, encerrarPrazo } from '@/server/advocacia/prazos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }

/** docs/101 T4: encerrar o prazo (cumprido com prova ou nota se fatal; perdido ou cancelado com motivo). */
export const POST = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse prazo não está mais disponível.' })
  const entrada = await lerCorpo(req, EsquemaEncerrarPrazo)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_deadlines')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/deadlines/${id}/close` }, async () => {
    const r = await encerrarPrazo(db, ctx.tenantId, id, ctx.sessao.userId, entrada)
    await writeAudit(
      { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: `legal_deadline.${entrada.status}`, entity: 'legal_deadlines', entityId: id, after: r, requestId },
      req,
    )
    return r
  })
})
