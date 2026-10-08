import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarCaso, EsquemaCriarCaso } from '@/server/advocacia/casos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/**
 * docs/101 T2.1: criar um caso do pacote Advocacia, já com as pendências do modelo do tipo de caso.
 *
 * Segundo fator AQUI, e não só na porta do painel (`contextoDoPainel`): a API é alcançável sem passar
 * pela tela, e o escritório inteiro exige `aal2` (docs/101 §6.3). Quem decide o sigilo é a RLS;
 * esta rota só confere permissão de papel e módulo.
 */
export const POST = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:create')

  const entrada = await lerCorpo(req, EsquemaCriarCaso)
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_cases')

  // estágio gera as pendências em rascunho: a advocacia aprova antes de o cliente ser cobrado
  const { data: eu } = await db.from('professionals').select('legal_role').eq('tenant_id', ctx.tenantId).eq('user_id', ctx.sessao.userId).maybeSingle()

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/cases' }, async () => {
    const caso = await criarCaso(db, ctx.tenantId, { timezone: ctx.tenant.timezone, agora: new Date(), criadoPorEstagio: eu?.legal_role === 'estagio' }, entrada)
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'legal_case.create',
        entity: 'legal_cases',
        entityId: caso.id,
        // sem título nem texto do caso na trilha: só o que identifica o ato
        after: { kind: entrada.kind, sensitivity: entrada.sensitivity, pendencias: caso.pendencias },
        requestId,
      },
      req,
    )
    return caso
  })
})
