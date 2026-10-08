import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { EsquemaAto, registrarAto } from '@/server/advocacia/estrutura-escrita'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }

/** docs/101 T3.1: ato societário (constituição, alteração, cessão, doação...) com o quadro novo. */
export const POST = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:create')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa empresa não está mais disponível.' })
  const entrada = await lerCorpo(req, EsquemaAto)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_structure')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/entities/${id}/changes` }, async () => {
    const r = await registrarAto(db, ctx.tenantId, id, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'legal_corporate_change.create',
        entity: 'legal_corporate_changes',
        entityId: r.ato,
        after: { tipo: entrada.kind, data: entrada.effectiveOn, socios: entrada.novoQuadro.length, fechadas: r.fechadas },
        requestId,
      },
      req,
    )
    return r
  })
})
