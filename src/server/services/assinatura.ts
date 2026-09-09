/**
 * Assinatura do CICLO — a orquestração. `docs/57` Bloco 1, PR 1.2.
 *
 * Três coisas: iniciar (dono clica "Assinar"), tratar o webhook do MP (o que muda `tenants.plan`),
 * e expirar a janela de graça (cron). A lógica pura está em `core/billing/mercado-pago.ts`; a ida
 * à API do MP em `server/billing/mercado-pago.ts`.
 */

import type { PlanoTier } from '@/core/billing/planos'
import type { EventoMP } from '@/core/billing/mercado-pago'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

import { lerAssinatura, decidirPlano, valorConfereComDegrau, type AssinaturaDoTenant } from '@/core/billing/mercado-pago'
import { PRECO_MENSAL_CENTS } from '@/core/billing/planos'
import {
  consultarPagamento,
  consultarPreapproval,
  criarPreapproval,
} from '@/server/billing/mercado-pago'
import { AppError } from '@/server/http/errors'

type Cliente = SupabaseClient<Database>
type Servico = SupabaseClient<Database>

const DIAS_DE_GRACA = 7

/** Só degrau cobrável. `gratis` não passa por aqui. */
export type TierCobravel = Exclude<PlanoTier, 'gratis'>
export const TIERS_COBRAVEIS: readonly TierCobravel[] = ['essencial', 'equipe', 'avancado']
export function ehTierCobravel(v: string): v is TierCobravel {
  return (TIERS_COBRAVEIS as readonly string[]).includes(v)
}

// ---------------------------------------------------------------------------------------------
// Iniciar (rota /api/v1/billing/assinar, cliente do usuário — a permissão já foi conferida lá)
// ---------------------------------------------------------------------------------------------

export async function iniciarAssinatura(
  db: Cliente,
  tenantId: string,
  tier: TierCobravel,
  payerEmail: string,
  backUrl: string,
): Promise<{ initPoint: string }> {
  const { preapprovalId, initPoint } = await criarPreapproval({ tenantId, tier, payerEmail, backUrl })

  const assinatura: AssinaturaDoTenant = {
    provedor: 'mercado_pago',
    preapproval_id: preapprovalId,
    plano_contratado: tier,
    status: 'pending',
    atualizado_em: new Date().toISOString(),
    graca_ate: null,
    ultimo_evento_id: null,
  }

  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })
  const settings = { ...((atual.settings ?? {}) as Record<string, unknown>), assinatura }

  const { error } = await db
    .from('tenants')
    .update({ settings: settings as Database['public']['Tables']['tenants']['Update']['settings'] })
    .eq('id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })

  return { initPoint }
}

// ---------------------------------------------------------------------------------------------
// Webhook (rota /api/v1/webhooks/mercado-pago, service_role — sem sessão)
// ---------------------------------------------------------------------------------------------

/**
 * Recebe o evento já normalizado (`lerNotificacaoMP`) e a assinatura já verificada
 * (`verificarAssinaturaWebhook`). Faz o trabalho e é **idempotente**: evento repetido → no-op.
 *
 * Devolve o que aconteceu, para o log da rota — nunca lança por evento "não interessa" (senão o
 * MP retenta para sempre).
 */
export async function aplicarEventoDeAssinatura(
  svc: Servico,
  evento: EventoMP,
  opts: { agora?: Date } = {},
): Promise<{ resultado: 'aplicado' | 'ignorado'; motivo?: string }> {
  const agora = opts.agora ?? new Date()

  // 1. resolver o preapproval e o valor autorizado
  let preapprovalId: string
  let externalReference: string | null
  let valorAutorizado: number | null
  let status: 'pending' | 'authorized' | 'paused' | 'cancelled'

  if (evento.assunto === 'subscription') {
    const s = await consultarPreapproval(evento.id)
    preapprovalId = evento.id
    externalReference = s.externalReference
    valorAutorizado = s.valorAutorizado
    status = s.status
  } else {
    // payment: o pagamento aponta para o preapproval; o status da assinatura em si vem de lá.
    const p = await consultarPagamento(evento.id)
    if (!p.preapprovalId) return { resultado: 'ignorado', motivo: 'pagamento sem preapproval (avulso)' }
    const s = await consultarPreapproval(p.preapprovalId)
    preapprovalId = p.preapprovalId
    externalReference = s.externalReference ?? p.externalReference
    valorAutorizado = s.valorAutorizado ?? p.valor
    status = s.status
  }

  if (!externalReference) return { resultado: 'ignorado', motivo: 'preapproval sem external_reference' }

  // 2. carregar o tenant e a assinatura que ELE gravou ao clicar "Assinar"
  const { data: tenant, error } = await svc
    .from('tenants')
    .select('id, plan, settings')
    .eq('id', externalReference)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!tenant) return { resultado: 'ignorado', motivo: 'tenant do external_reference não existe' }

  const assinatura = lerAssinatura(tenant.settings)
  if (!assinatura || assinatura.preapproval_id !== preapprovalId) {
    // O MP mandou um evento de um preapproval que este tenant não iniciou (ou já trocou). Não é
    // erro do MP — responde 200 e ignora, mas registra: pode ser tentativa de fraude.
    await auditar(svc, tenant.id, 'tenant.subscription.evento_orfao', { evento, preapprovalId })
    return { resultado: 'ignorado', motivo: 'preapproval não bate com o do tenant' }
  }

  // 3. idempotência
  if (assinatura.ultimo_evento_id === evento.id) return { resultado: 'ignorado', motivo: 'evento repetido' }

  // 4. o valor autorizado TEM que bater com o degrau contratado
  if (valorAutorizado != null && !valorConfereComDegrau(assinatura.plano_contratado, valorAutorizado)) {
    await auditar(svc, tenant.id, 'tenant.subscription.valor_divergente', {
      contratado: assinatura.plano_contratado,
      esperadoCents: PRECO_MENSAL_CENTS[assinatura.plano_contratado],
      autorizadoReais: valorAutorizado,
    })
    return { resultado: 'ignorado', motivo: 'valor autorizado não bate com o degrau' }
  }

  // 5. decidir e gravar
  const decisao = decidirPlano(status, assinatura.plano_contratado, tenant.plan as PlanoTier)
  const novaAssinatura: AssinaturaDoTenant = {
    ...assinatura,
    status,
    atualizado_em: agora.toISOString(),
    graca_ate: decisao.emGraca ? new Date(agora.getTime() + DIAS_DE_GRACA * 86_400_000).toISOString() : null,
    ultimo_evento_id: evento.id,
  }
  const settings = { ...((tenant.settings ?? {}) as Record<string, unknown>), assinatura: novaAssinatura }

  const { error: erroUpdate } = await svc
    .from('tenants')
    .update({
      plan: decisao.plano,
      settings: settings as Database['public']['Tables']['tenants']['Update']['settings'],
    })
    .eq('id', tenant.id)
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  await auditar(svc, tenant.id, 'tenant.plan.change', {
    de: tenant.plan,
    para: decisao.plano,
    status,
    em_graca: decisao.emGraca,
    por: 'webhook_mp',
  })

  return { resultado: 'aplicado', motivo: `${status} → ${decisao.plano}${decisao.emGraca ? ' (graça)' : ''}` }
}

// ---------------------------------------------------------------------------------------------
// Expirar graça (cron /api/cron/expirar-graca — PR 3.1)
// ---------------------------------------------------------------------------------------------

export async function expirarGracaVencida(svc: Servico, agora: Date = new Date()): Promise<number> {
  const { data, error } = await svc
    .from('tenants')
    .select('id, plan, settings')
    .not('settings->assinatura', 'is', null)
    .is('deleted_at', null)
  if (error) throw new AppError('INTERNAL', { cause: error })

  let derrubados = 0
  for (const t of data ?? []) {
    const a = lerAssinatura(t.settings)
    if (!a || a.status !== 'paused' || !a.graca_ate) continue
    if (new Date(a.graca_ate) > agora) continue

    const settings = {
      ...((t.settings ?? {}) as Record<string, unknown>),
      assinatura: { ...a, graca_ate: null, atualizado_em: agora.toISOString() } satisfies AssinaturaDoTenant,
    }
    const { error: erroUpdate } = await svc
      .from('tenants')
      .update({ plan: 'gratis', settings: settings as Database['public']['Tables']['tenants']['Update']['settings'] })
      .eq('id', t.id)
    if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })
    await auditar(svc, t.id, 'tenant.plan.change', { de: t.plan, para: 'gratis', por: 'graca_expirada' })
    derrubados++
  }
  return derrubados
}

// ---------------------------------------------------------------------------------------------

async function auditar(svc: Servico, tenantId: string, action: string, after: Record<string, unknown>): Promise<void> {
  const { error } = await svc.from('audit_log').insert({
    tenant_id: tenantId,
    action,
    entity: 'tenants',
    entity_id: tenantId,
    after: after as Database['public']['Tables']['audit_log']['Insert']['after'],
  })
  if (error) console.error(JSON.stringify({ level: 'error', event: 'audit_assinatura_falhou', action }), error)
}
