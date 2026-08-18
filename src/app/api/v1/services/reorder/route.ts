import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaReordenar, reordenarServicos } from '@/server/services/servicos'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'service:update')

  const { ids } = await lerCorpo(req, EsquemaReordenar)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: '/api/v1/services/reorder' },
    () => reordenarServicos(db, ctx.tenantId, ids),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'service.reorder',
      entity: 'services',
      after: { ids },
      requestId,
    },
    req,
  )

  return resultado
})
