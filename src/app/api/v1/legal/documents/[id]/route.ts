import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { conferirDocumento, EsquemaConferencia } from '@/server/advocacia/documentos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }

/** docs/101 T2.3: conferência do documento recebido do cliente (aceitar, ou recusar com motivo). */
export const PATCH = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:update')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse documento não está mais disponível.' })
  const entrada = await lerCorpo(req, EsquemaConferencia)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_documents')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/documents/${id}` }, async () => {
    const r = await conferirDocumento(db, ctx.tenantId, id, ctx.sessao.userId, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: `legal_document.${entrada.acao}`,
        entity: 'legal_documents',
        entityId: id,
        after: r,
        requestId,
      },
      req,
    )
    return r
  })
})
