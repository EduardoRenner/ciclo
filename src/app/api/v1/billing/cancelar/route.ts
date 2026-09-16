import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { cancelarAssinatura } from '@/server/services/assinatura-mp'

/**
 * `docs/18` Fase K: "Cancelar — autoatendimento, mesmo número de cliques que assinar". Sem corpo,
 * sem confirmação num modal — a decisão da casa foi paridade literal de cliques com `/assinar`,
 * não a cautela extra de um passo a mais. `tenant:update`, mesma régua do resto de `/tenant`.
 *
 * T1.5 (docs/64 §0.2): ao contrário de `/assinar`, esta rota **de propósito não** checa
 * `ehRequisicaoDoAppNativo` — bloquear CANCELAMENTO dentro do app nativo seria o oposto do que a
 * guideline 3.1.1/5.1.1 pede: apps que dificultam cancelar assinatura são o próprio padrão que a
 * Apple pune (e cada vez mais também regulação de consumidor, tipo a regra "click-to-cancel" da
 * FTC). Só a CRIAÇÃO de cobrança é o risco desta ficha; encerrar uma cobrança que já existe nunca
 * é "direcionar pra compra fora do app". Não "conserte" isto adicionando o mesmo bloqueio de
 * `/assinar` — é decisão, não esquecimento.
 */
export const POST = rota(async (req, _params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const db = await criarClienteDoUsuario()
  const resultado = await comIdempotencia(
    req,
    { tenantId: ctx.tenantId, endpoint: '/api/v1/billing/cancelar' },
    () => cancelarAssinatura(db, ctx.tenantId),
  )

  if (resultado.resultado === 'cancelada') {
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: 'tenant.subscription.cancel',
        entity: 'tenants',
        entityId: ctx.tenantId,
        after: { plano: resultado.plano },
        requestId,
      },
      req,
    )
  }

  return resultado
})
