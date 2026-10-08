import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarPrazo, EsquemaNovoPrazo } from '@/server/advocacia/prazos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/** docs/101 T4: prazo criado à mão (interno, audiência, contratual ou fatal). */
export const POST = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:create')

  const entrada = await lerCorpo(req, EsquemaNovoPrazo)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_deadlines')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/deadlines' }, async () => {
    const r = await criarPrazo(db, ctx.tenantId, ctx.sessao.userId, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'legal_deadline.create',
        entity: 'legal_deadlines',
        entityId: r.id,
        after: { tipo: entrada.kind, vence: entrada.dueOn },
        requestId,
      },
      req,
    )
    return r
  })
})
