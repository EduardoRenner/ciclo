import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { debitarCarteira, EsquemaMovimentoCarteira } from '@/server/services/pacotes'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const entrada = await lerCorpo(req, EsquemaMovimentoCarteira)
  const db = await criarClienteDoUsuario()

  const balanceCents = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/wallet/debit' }, () =>
    debitarCarteira(db, ctx.tenantId, entrada),
  )
  return { balanceCents }
})
