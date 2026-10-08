import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { decidirIntimacao, EsquemaDecisao } from '@/server/advocacia/intimacoes'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/101 T4.2: a decisão da triagem (vincular, criar prazo, "não gera prazo", descartar). Quem
 * decide o que vale é a RPC da 0112, que repete as checagens da RLS; esta rota confere segundo fator,
 * pacote, papel e módulo, e grava a trilha sem o texto do tribunal.
 */
export const POST = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa intimação não está mais disponível.' })
  const entrada = await lerCorpo(req, EsquemaDecisao)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_deadlines')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/intimations/${id}/decide` }, async () => {
    const r = await decidirIntimacao(db, id, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: `legal_intimation.${entrada.acao}`,
        entity: 'legal_intimations',
        entityId: id,
        after: { status: r.status, ...(r.deadline_id ? { deadline_id: r.deadline_id } : {}) },
        requestId,
      },
      req,
    )
    return r
  })
})
