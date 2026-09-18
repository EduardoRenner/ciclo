import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { debitarCarteira, EsquemaMovimentoCarteira } from '@/server/services/pacotes'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const entrada = await lerCorpo(req, EsquemaMovimentoCarteira)
  const db = await criarClienteDoUsuario()

  const balanceCents = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/wallet/debit' }, () =>
    debitarCarteira(db, ctx.tenantId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'wallet.debit',
      entity: 'wallet_entries',
      entityId: entrada.clientId,
      after: { ...entrada, balanceCents },
      requestId,
    },
    req,
  )

  return { balanceCents }
})
