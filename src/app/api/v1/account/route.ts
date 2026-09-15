import { writeAudit } from '@/server/audit/write'
import { exigirAal2 } from '@/server/auth/session'
import { withNovoTenant } from '@/server/db/with-tenant'
import { excluirPropriaConta, situacaoDaConta } from '@/server/services/conta'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

/**
 * T-DEL (docs/64 §0.3). `GET` é a checagem — a tela de confirmação lê isto ANTES de mostrar o
 * botão final, pra dizer com clareza o que vai acontecer (ou por que não pode acontecer ainda).
 * `DELETE` é a ação de verdade, atrás de `exigirAal2()`: excluir a própria conta é a ação mais
 * destrutiva que existe pra uma pessoa, e merece a mesma trava de segundo fator que já protege o
 * `erase` da cliente.
 */
export const GET = rota(async () => {
  const sessao = await exigirAal2()
  return withNovoTenant((svc) => situacaoDaConta(svc, sessao.userId))
})

export const DELETE = rota(async (req, _ctx, requestId) => {
  const sessao = await exigirAal2()

  // Não existe um `tenantId` único aqui — a exclusão pode atingir zero, um ou vários negócios ao
  // mesmo tempo. `idempotency_keys.tenant_id` não tem FK (migration 0001): é só o prefixo que evita
  // colisão de chave entre pedidos concorrentes (`server/http/idempotency.ts`), então o próprio
  // `userId` serve igual a um tenant de verdade pra esse propósito — a fila offline não pode
  // reenviar esta exclusão duas vezes sem que a segunda vez devolva a mesma resposta da primeira.
  const vinculos = await comIdempotencia(req, { tenantId: sessao.userId, endpoint: '/api/v1/account' }, () =>
    withNovoTenant((svc) => excluirPropriaConta(svc, sessao.userId)),
  )

  // Um registro por tenant onde a conta tinha vínculo — `writeAudit` exige `tenantId`, e a exclusão
  // pode atingir mais de um negócio de uma vez (quem é `professional` em dois salões, por exemplo).
  // Grava DEPOIS de excluir de propósito: `actor_id` em `audit_log` não tem FK pra `auth.users`
  // (migration 0001), então não há corrida com a exclusão já ter acontecido.
  for (const vinculo of vinculos) {
    await writeAudit(
      {
        tenantId: vinculo.tenantId,
        actorId: sessao.userId,
        actorRole: vinculo.role,
        action: 'account.self_delete',
        entity: 'memberships',
        entityId: sessao.userId,
        requestId,
      },
      req,
    )
  }

  return { deleted: true }
})
