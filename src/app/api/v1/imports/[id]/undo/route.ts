import { UUID } from '@/core/text/uuid'
import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { desfazerLote } from '@/server/services/lote-de-importacao'

type Ctx = { params: Promise<{ id: string }> }

/**
 * docs/103 CNV-022 · Desfaz a importação em até 7 dias. A mesma autoridade de quem importa; o banco
 * confere de novo (papel, prazo, uma vez só) dentro da transação.
 */
export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  const escopo = exigirPermissao(ctx.papel, 'client:create')
  if (escopo === 'own') throw new AppError('FORBIDDEN', { message: 'Desfazer a importação é com o dono, a gerência ou a recepção.' })
  const { id } = await (params as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Não achei esta importação.' })
  const db = await criarClienteDoUsuario()

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/imports/${id}/undo` }, async () => {
    const resultado = await desfazerLote(db, id)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'import.undo',
        entity: 'import_batches',
        entityId: id,
        after: resultado,
        requestId,
      },
      req,
    )
    return resultado
  })
})
