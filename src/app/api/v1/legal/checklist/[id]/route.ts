import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { agirNaPendencia, EsquemaAcaoNaPendencia } from '@/server/advocacia/casos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/101 T2.2: uma ação numa pendência ("o que falta de você"): aprovar rascunho, marcar recebida,
 * conferir, concluir, devolver (motivo, rodada nova) ou cancelar (motivo). A regra de qual ação vale
 * em qual estado é `core/advocacia/checklist.ts`; a concorrência é o `rowVersion`.
 */
export const PATCH = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa pendência não está mais disponível.' })
  const entrada = await lerCorpo(req, EsquemaAcaoNaPendencia)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_checklists')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/checklist/${id}` }, async () => {
    const r = await agirNaPendencia(db, ctx.tenantId, id, { userId: ctx.sessao.userId, timezone: ctx.tenant.timezone, agora: new Date() }, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: `legal_checklist.${entrada.acao}`,
        entity: 'legal_checklist_items',
        entityId: r.id,
        after: { estado: r.estado, rodada: r.rodada },
        requestId,
      },
      req,
    )
    return r
  })
})
