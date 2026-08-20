import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario, exigirEnv } from '@/server/db/server-client'
import { criarOrcamento, EsquemaCriarOrcamento } from '@/server/services/orcamentos'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'appointment:create') // orçamento é um passo antes do agendamento — mesmo alcance

  const entrada = await lerCorpo(req, EsquemaCriarOrcamento)
  const db = await criarClienteDoUsuario()

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/quotes' }, () =>
    criarOrcamento(db, ctx.tenantId, ctx.sessao.userId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'quote.create',
      entity: 'quotes',
      entityId: resultado.quote.id,
      after: resultado.quote,
      requestId,
    },
    req,
  )

  return { ...resultado, url: `${exigirEnv('NEXT_PUBLIC_APP_URL')}/orcamento/${resultado.token}` }
})
