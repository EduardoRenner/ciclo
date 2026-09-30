import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { creditarCarteira, EsquemaMovimentoCarteira } from '@/server/services/pacotes'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const entrada = await lerCorpo(req, EsquemaMovimentoCarteira)
  const db = await criarClienteDoUsuario()

  /*
   * BL-42 (`.claude/ciclo/autonomous-backlog.md`): `writeAudit` mora DENTRO do fechamento que
   * `comIdempotencia` protege, não depois dele. Fora, uma repetição com a mesma `Idempotency-Key`
   * (fila offline reenviando, toque duplo) recebia a resposta CACHEADA sem repetir `creditarCarteira`
   * — mas gravava uma linha NOVA em `audit_log` a cada repetição, descrevendo um crédito que só
   * aconteceu uma vez. `comIdempotencia` só executa este fechamento na tentativa FRESCA; numa
   * repetição ele nem chama a função, então `writeAudit` também não roda. O valor de retorno não
   * muda: é o mesmo `{ balanceCents }` de antes, só a auditoria some do caminho de cache hit.
   */
  const balanceCents = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/wallet/credit' }, async () => {
    const balanceCents = await creditarCarteira(db, ctx.tenantId, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'wallet.credit',
        entity: 'wallet_entries',
        entityId: entrada.clientId,
        after: { ...entrada, balanceCents },
        requestId,
      },
      req,
    )
    return balanceCents
  })

  return { balanceCents }
})
