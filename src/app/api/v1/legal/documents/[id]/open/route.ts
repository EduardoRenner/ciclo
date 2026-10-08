import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { abrirDocumento } from '@/server/advocacia/documentos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { ipConfiavelOuNulo } from '@/server/http/ip'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/101 T2.3: abrir um documento. POST, e não GET, porque grava trilha (`legal_access_log`) antes de
 * assinar a URL de 60 s; um GET seria pré-carregado por navegador e por prévia de link, e cada prévia
 * viraria uma "abertura" falsa na trilha.
 */
export const POST = rota(async (req, params, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:read')

  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Esse documento não está mais disponível.' })
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_documents')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/legal/documents/${id}/open` }, async () => {
    const r = await abrirDocumento(db, ctx.tenantId, id, { userId: ctx.sessao.userId, ip: ipConfiavelOuNulo(req) })
    await writeAudit(
      { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'legal_document.open', entity: 'legal_documents', entityId: id, requestId },
      req,
    )
    return r
  })
})
