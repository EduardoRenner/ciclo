import {
  decidirPlano,
  lerAssinatura,
  valorConfereComDegrau,
  type AssinaturaDoTenant,
  type EventoMP,
} from '@/core/billing/mercado-pago'
import type { PlanoTier } from '@/core/billing/planos'
import { normalizarPlano } from '@/server/services/planos'
import { cancelarPreapproval, consultarPagamento, consultarPreapproval, criarPreapproval } from '@/server/billing/mercado-pago'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const DIAS_DE_GRACA = 7

/** Só degrau cobrável — `gratis` não passa por checkout nenhum. */
export type TierCobravel = Exclude<PlanoTier, 'gratis'>
export const TIERS_COBRAVEIS: readonly TierCobravel[] = ['essencial', 'equipe', 'avancado']
export function ehTierCobravel(v: string): v is TierCobravel {
  return (TIERS_COBRAVEIS as readonly string[]).includes(v)
}

// ---------------------------------------------------------------------------------------------
// Iniciar (rota POST /api/v1/billing/assinar, cliente do usuário — permissão já conferida lá)
// ---------------------------------------------------------------------------------------------

/**
 * O dono clica "Assinar {plano}" → cria o preapproval no MP e grava a INTENÇÃO em
 * `tenants.settings.assinatura` (`status: 'pending'`). Quem grava o plano de verdade é
 * `processarWebhookMP`, quando o MP confirmar o pagamento — aqui só nasce o registro que o webhook
 * vai procurar pelo `preapproval_id`.
 */
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
// Cancelar (rota POST /api/v1/billing/cancelar, cliente do usuário)
// ---------------------------------------------------------------------------------------------

/**
 * O dono clica "Cancelar assinatura" → cancela o preapproval no MP e derruba para `gratis` NA
 * HORA, sem esperar o webhook (`docs/18` Fase K: "mesmo número de cliques que assinar" — esperar
 * faria o clique único parecer que não funcionou). Idempotente por construção: chamar de novo numa
 * assinatura já cancelada/inexistente é `sem_assinatura_ativa`, não erro.
 *
 * Regra 11 do CLAUDE.md ("nunca delete... use estado/compensação") não se aplica aqui: isto é a
 * PRÓPRIA transição de estado que a regra pede, não um delete de linha nem de histórico.
 */
export async function cancelarAssinatura(
  db: Cliente,
  tenantId: string,
): Promise<{ resultado: 'cancelada'; plano: PlanoTier } | { resultado: 'sem_assinatura_ativa' }> {
  const { data: tenant, error } = await db.from('tenants').select('plan, settings').eq('id', tenantId).single()
  if (error) throw new AppError('INTERNAL', { cause: error })

  const assinatura = lerAssinatura(tenant.settings)
  if (!assinatura || assinatura.status === 'cancelled') return { resultado: 'sem_assinatura_ativa' }

  await cancelarPreapproval(assinatura.preapproval_id)

  const novaAssinatura: AssinaturaDoTenant = {
    ...assinatura,
    status: 'cancelled',
    atualizado_em: new Date().toISOString(),
    graca_ate: null,
  }
  const { error: erroUpdate } = await db
    .from('tenants')
    .update({
      plan: 'gratis',
      settings: { ...((tenant.settings ?? {}) as Record<string, unknown>), assinatura: novaAssinatura },
    })
    .eq('id', tenantId)
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  return { resultado: 'cancelada', plano: 'gratis' }
}

export type ResultadoWebhookMP =
  | { resultado: 'plano_atualizado'; tenantId: string; plano: string }
  | { resultado: 'sem_assinatura_registrada'; tenantId: string | null }
  | { resultado: 'valor_nao_confere'; tenantId: string }
  | { resultado: 'tenant_nao_encontrado' }

/**
 * G-13 (docs/60) — o webhook de status do Mercado Pago. `core/billing/mercado-pago.ts` já tem toda
 * a regra pura (`decidirPlano`, `valorConfereComDegrau`, `lerAssinatura`); este arquivo é só a cola
 * de I/O que faltava — reconsulta a API do MP (nunca confia no corpo do webhook) e escreve o
 * degrau em `tenants`.
 *
 * ## Por que SEMPRE reconsulta a API, nunca lê o valor do corpo do webhook
 *
 * O corpo da notificação é só "aconteceu algo com o id X" — os CAMPOS que ele eventualmente trouxer
 * (status, valor) não são a fonte da verdade, porque um webhook forjado poderia declarar
 * `status: 'authorized'` para qualquer id. A fonte da verdade é a resposta de
 * `consultarPreapproval`/`consultarPagamento`, autenticada pelo próprio token de acesso do CICLO
 * junto ao MP — por isso `EventoMP` (o que `lerNotificacaoMP` extrai) só carrega `assunto` + `id`.
 *
 * ## Por que um evento de `payment` também reconsulta a PREAPPROVAL, não só o pagamento
 *
 * Um pagamento avulso tem o próprio vocabulário de status (`approved`/`rejected`/...), diferente do
 * vocabulário de assinatura (`STATUS_MP`). Duplicar a decisão a partir do status do pagamento
 * criaria uma segunda definição da mesma regra — a armadilha de "duas cópias da mesma fórmula"
 * já registrada nesta base. Em vez disso, todo evento (assinatura OU pagamento) termina reduzido à
 * MESMA pergunta: "qual é o status ATUAL da assinatura?", respondida sempre pela preapproval.
 */
export async function processarWebhookMP(
  db: Cliente,
  evento: EventoMP,
  // Injetáveis só para teste — sem credencial do MP, não dá para bater na API de verdade. Mesmo
  // padrão de `enviarPushFn` em `mensageria.ts`: produção nunca passa o terceiro/quarto argumento.
  consultarPagamentoFn: typeof consultarPagamento = consultarPagamento,
  consultarPreapprovalFn: typeof consultarPreapproval = consultarPreapproval,
): Promise<ResultadoWebhookMP> {
  const preapprovalId = evento.assunto === 'subscription' ? evento.id : (await consultarPagamentoFn(evento.id)).preapprovalId

  if (!preapprovalId) {
    // Pagamento sem preapproval associado (ex.: cobrança avulsa fora do fluxo de assinatura) —
    // não é este webhook que decide nada sobre ele.
    return { resultado: 'sem_assinatura_registrada', tenantId: null }
  }

  const situacao = await consultarPreapprovalFn(preapprovalId)
  if (!situacao.externalReference) return { resultado: 'tenant_nao_encontrado' }
  const tenantId = situacao.externalReference

  const { data: tenant, error } = await db.from('tenants').select('plan, settings').eq('id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!tenant) return { resultado: 'tenant_nao_encontrado' }

  const assinatura = lerAssinatura(tenant.settings)
  if (!assinatura || assinatura.preapproval_id !== preapprovalId) {
    // Preapproval existe no MP mas este tenant não tem registro dela (ou tem uma DIFERENTE) — não
    // dá para saber com segurança qual degrau ela autoriza. Fica como está; alguém humano confere.
    return { resultado: 'sem_assinatura_registrada', tenantId }
  }

  // A guarda contra checkout adulterado: o valor autorizado no MP precisa bater com o degrau que
  // ESTA assinatura diz ter contratado — nunca com um valor que o webhook alegue.
  if (situacao.valorAutorizado !== null && !valorConfereComDegrau(assinatura.plano_contratado, situacao.valorAutorizado)) {
    return { resultado: 'valor_nao_confere', tenantId }
  }

  const planoVigente = normalizarPlano(tenant.plan)
  const decisao = decidirPlano(situacao.status, assinatura.plano_contratado, planoVigente)

  const novaAssinatura: AssinaturaDoTenant = {
    ...assinatura,
    status: situacao.status,
    atualizado_em: new Date().toISOString(),
    // Recalculada a cada webhook de `paused` (não só na primeira vez) — ver o comentário do campo
    // em `core/billing/mercado-pago.ts`. `null` assim que sair de `paused`, para não sobrar data
    // de graça velha numa assinatura que já voltou a pagar.
    graca_ate: decisao.emGraca ? new Date(Date.now() + DIAS_DE_GRACA * 86_400_000).toISOString() : null,
  }

  const { error: erroUpdate } = await db
    .from('tenants')
    .update({ plan: decisao.plano, settings: { ...(tenant.settings as Record<string, unknown>), assinatura: novaAssinatura } })
    .eq('id', tenantId)
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  return { resultado: 'plano_atualizado', tenantId, plano: decisao.plano }
}

// ---------------------------------------------------------------------------------------------
// Expirar graça (rota GET /api/cron/expirar-graca)
// ---------------------------------------------------------------------------------------------

/**
 * Varre tenants com assinatura registrada, e derruba para `gratis` quem está `paused` com
 * `graca_ate` no passado — ou seja, o MP tentou cobrar e falhou por 7 dias seguidos sem se
 * recuperar. Sem isto, uma assinatura pausada fica no degrau pago para sempre: o webhook só
 * REAGE a evento novo do MP, e o MP para de mandar evento quando desiste de retentar.
 */
export async function expirarGracaVencida(svc: Cliente, agora: Date = new Date()): Promise<number> {
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

    const novaAssinatura: AssinaturaDoTenant = { ...a, graca_ate: null, atualizado_em: agora.toISOString() }
    const { error: erroUpdate } = await svc
      .from('tenants')
      .update({
        plan: 'gratis',
        settings: { ...((t.settings ?? {}) as Record<string, unknown>), assinatura: novaAssinatura },
      })
      .eq('id', t.id)
    if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

    // Insert direto, não `writeAudit`: o cron não tem `Request` de pessoa nenhuma para tirar
    // IP/user-agent, e `request_id` é opcional na tabela. Mesma exceção que `service_role` já é.
    const { error: erroAudit } = await svc.from('audit_log').insert({
      tenant_id: t.id,
      action: 'tenant.plan.change',
      entity: 'tenants',
      entity_id: t.id,
      after: { de: t.plan, para: 'gratis', por: 'graca_expirada' } as never,
    })
    if (erroAudit) console.error(JSON.stringify({ level: 'error', event: 'audit_graca_expirada_falhou', tenantId: t.id }), erroAudit)

    derrubados++
  }
  return derrubados
}
