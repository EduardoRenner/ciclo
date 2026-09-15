import { z } from 'zod'

import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { APP_HOST, APP_URL } from '@/lib/app-url'
import { AppError } from '@/server/http/errors'
import { lerCorpo } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { ehTierCobravel, iniciarAssinatura, TIERS_COBRAVEIS } from '@/server/services/assinatura-mp'

/**
 * O dono clica "Assinar {plano}" em `/admin/config/meu-plano` → esta rota cria o preapproval no
 * Mercado Pago e devolve o `initPoint` (a URL de checkout). Quem grava o plano de verdade é o
 * webhook (`processarWebhookMP`, `/api/v1/webhooks/mercado-pago`) quando o pagamento é autorizado
 * — aqui só nasce a intenção (`status: 'pending'`).
 *
 * Reconciliação de `docs/63-AUDITORIA-PENDENCIAS-2026-09-13.md`: esta rota já tinha sido escrita e
 * revisada (PR #91), mas ficou presa num branch cuja base era outro branch de feature, não `main`
 * — nunca chegou em produção. Reescrita aqui contra `assinatura-mp.ts` (o service que SUBSTITUIU
 * o `assinatura.ts` original, via #122), não um merge cego do branch antigo.
 *
 * `tenant:update` (só `owner`, como `payment-fees` e o resto de `/tenant`): mexer no plano é mexer
 * no que o estabelecimento paga.
 */
const Esquema = z.object({
  tier: z.enum(TIERS_COBRAVEIS as unknown as [string, ...string[]]),
})

export const POST = rota(async (req, _params, requestId) => {
  // T1.5 (docs/64 §0.2): a tela some pro app nativo, mas a rota também precisa recusar — quem
  // sabe montar a requisição direto (DevTools do WebView, replay) não pode contornar escondendo
  // só o botão. Guideline 3.1.1 não abre exceção pro CICLO (§0.9): a assinatura desbloqueia
  // módulo DENTRO do app, a definição textual da regra.
  if (ehRequisicaoDoAppNativo(req.headers.get('user-agent'))) {
    throw new AppError('FORBIDDEN', { message: `Gerencie seu plano em ${APP_HOST}.` })
  }

  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const { tier } = await lerCorpo(req, Esquema)
  if (!ehTierCobravel(tier)) throw new Error('tier inválido') // o enum do Zod já garante; guarda de tipo pro TS

  if (!ctx.sessao.email) {
    // O MP exige `payer_email` no preapproval. Sem e-mail na sessão não dá para seguir.
    throw new Error('Sua conta não tem e-mail — o Mercado Pago precisa dele para a assinatura.')
  }

  const db = await criarClienteDoUsuario()
  const { initPoint } = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: '/api/v1/billing/assinar' },
    () => iniciarAssinatura(db, ctx.tenantId, tier, ctx.sessao.email, `${APP_URL}/admin/config/meu-plano`),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.subscription.start',
      entity: 'tenants',
      entityId: ctx.tenantId,
      after: { tier },
      requestId,
    },
    req,
  )

  return { initPoint }
})
