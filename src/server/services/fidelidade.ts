import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

// ───────────────────────────────────────────── pontos

export const EsquemaPontos = z.object({
  points: z.number().int().refine((n) => n !== 0, 'Informe quantos pontos.').min(-10_000).max(10_000),
  reason: z.string().trim().min(2, 'Diga o motivo.').max(120),
  appointmentId: z.uuid().nullish(),
})

export type ExtratoPontos = {
  saldo: number
  lancamentos: { id: string; points: number; reason: string; createdAt: string }[]
}

// ───────────────────────────────────────────── configuração e automação

export const EsquemaConfigFidelidade = z.object({
  /** 0 desliga a pontuação automática — nem todo negócio quer fidelidade ligada. */
  pointsPerReal: z.number().int().min(0).max(100),
  referralBonusPoints: z.number().int().min(0).max(10_000),
  /** A cada quantos pontos completa uma "volta" da barra de progresso na ficha. */
  rewardThreshold: z.number().int().min(1).max(100_000),
  rewardLabel: z.string().trim().max(80).nullish(),
})
export type ConfigFidelidade = z.infer<typeof EsquemaConfigFidelidade>

const CONFIG_PADRAO: ConfigFidelidade = {
  pointsPerReal: 1,
  referralBonusPoints: 20,
  rewardThreshold: 100,
  rewardLabel: null,
}

/** Nunca lança — tenant antigo pode não ter `settings.loyalty` nenhum; vira o padrão. */
export function lerConfigFidelidade(settings: unknown): ConfigFidelidade {
  const bruto = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).loyalty : null
  const resultado = EsquemaConfigFidelidade.safeParse(bruto ?? {})
  return resultado.success ? resultado.data : CONFIG_PADRAO
}

/** Mesmo padrão de merge de `site.ts`: lê `settings` inteiro, troca só a chave `loyalty`. */
export async function atualizarConfigFidelidade(db: Cliente, tenantId: string, entrada: ConfigFidelidade) {
  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

  const settingsAtual = (atual.settings ?? {}) as Record<string, unknown>
  const { error } = await db
    .from('tenants')
    .update({ settings: { ...settingsAtual, loyalty: entrada } })
    .eq('id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return entrada
}

/**
 * O que transforma fidelidade de "botão que a profissional lembra de apertar" em automação de
 * verdade — chamado por `concluirAgendamento` depois que o atendimento vira `done`. Nunca lança
 * (mesmo padrão do recálculo de ciclo ali do lado): premiar pontos é bônus, não pode derrubar a
 * conclusão do atendimento se falhar.
 *
 * Cobre dois casos, que podem coexistir na mesma conclusão:
 * 1. Pontos pela própria visita (`pointsPerReal × valor`), se a configuração tiver isso ligado.
 * 2. Bônus de indicação, só na PRIMEIRA visita concluída de quem foi indicado — pesquisa de
 *    mercado (Trinks, BonusQR) mostra que o padrão do nicho é recompensar os dois lados
 *    (`referred_by`), não só quem chegou.
 */
export async function pontuarAtendimentoConcluido(
  db: Cliente,
  tenantId: string,
  entrada: { appointmentId: string; clientId: string; priceCents: number },
): Promise<void> {
  const { data: tenant } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const config = lerConfigFidelidade(tenant?.settings)

  const lancamentos: Database['public']['Tables']['loyalty_entries']['Insert'][] = []

  if (config.pointsPerReal > 0) {
    const pontos = Math.floor((entrada.priceCents / 100) * config.pointsPerReal)
    if (pontos > 0) {
      lancamentos.push({
        tenant_id: tenantId,
        client_id: entrada.clientId,
        appointment_id: entrada.appointmentId,
        points: pontos,
        reason: 'Pontos do atendimento',
      })
    }
  }

  if (config.referralBonusPoints > 0) {
    const { data: cliente } = await db
      .from('clients')
      .select('referred_by, visits_count')
      .eq('id', entrada.clientId)
      .maybeSingle()

    // `visits_count` só reflete o job diário — na conclusão de agora ele ainda mostra o número
    // ANTES desta visita. `=== 0` é exatamente "esta é a primeira vez que ele conclui algo".
    if (cliente?.referred_by && cliente.visits_count === 0) {
      lancamentos.push(
        { tenant_id: tenantId, client_id: cliente.referred_by, points: config.referralBonusPoints, reason: 'Indicou um novo cliente' },
        { tenant_id: tenantId, client_id: entrada.clientId, points: config.referralBonusPoints, reason: 'Veio por indicação' },
      )
    }
  }

  if (lancamentos.length === 0) return
  const { error } = await db.from('loyalty_entries').insert(lancamentos)
  if (error) throw new AppError('INTERNAL', { cause: error })
}

/**
 * Livro-razão de pontos: só entra linha, nunca some (regra 11). Resgatar é lançar pontos
 * negativos com o motivo — assim o cliente que pergunta "por que eu tinha 80 e agora tenho 30?"
 * tem resposta na tela, em vez de um número que mudou sozinho.
 */
export async function extratoDePontos(db: Cliente, tenantId: string, clientId: string): Promise<ExtratoPontos> {
  const { data, error } = await db
    .from('loyalty_entries')
    .select('id, points, reason, created_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new AppError('INTERNAL', { cause: error })

  const lancamentos = data ?? []
  return {
    saldo: lancamentos.reduce((s, l) => s + l.points, 0),
    lancamentos: lancamentos.map((l) => ({
      id: l.id,
      points: l.points,
      reason: l.reason,
      createdAt: l.created_at,
    })),
  }
}

export async function lancarPontos(
  db: Cliente,
  tenantId: string,
  clientId: string,
  autorId: string,
  entrada: z.infer<typeof EsquemaPontos>,
) {
  // Resgate não pode deixar o saldo negativo — o cliente estaria "devendo pontos", que não existe.
  if (entrada.points < 0) {
    const { saldo } = await extratoDePontos(db, tenantId, clientId)
    if (saldo + entrada.points < 0) {
      throw AppError.validacao({ points: `Só há ${saldo} ponto(s) disponível(is).` })
    }
  }

  const { data, error } = await db
    .from('loyalty_entries')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      appointment_id: entrada.appointmentId ?? null,
      points: entrada.points,
      reason: entrada.reason,
      created_by: autorId,
    })
    .select('id, points, reason, created_at')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

// ───────────────────────────────────────────── clube de assinatura

export const EsquemaPlano = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao plano.').max(60),
  priceCents: z.number().int().min(0).max(10_000_000),
  /** `null` = ilimitado. Barbearia usa muito "corte quantas vezes quiser por R$ X". */
  sessionsPerMonth: z.number().int().min(1).max(31).nullish(),
  benefits: z.string().trim().max(500).nullish(),
  active: z.boolean().default(true),
})

export const EsquemaAssinatura = z.object({
  planId: z.uuid(),
  billingDay: z.number().int().min(1).max(28),
})

export async function listarPlanos(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('subscription_plans')
    .select('id, name, price_cents, sessions_per_month, benefits, active')
    .eq('tenant_id', tenantId)
    .order('price_cents')

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

export async function criarPlano(db: Cliente, tenantId: string, entrada: z.infer<typeof EsquemaPlano>) {
  const { data, error } = await db
    .from('subscription_plans')
    .insert({
      tenant_id: tenantId,
      name: entrada.name,
      price_cents: entrada.priceCents,
      sessions_per_month: entrada.sessionsPerMonth ?? null,
      benefits: entrada.benefits ?? null,
      active: entrada.active,
    })
    .select('id, name, price_cents, sessions_per_month, benefits, active')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export type AssinaturaDoCliente = {
  id: string
  planName: string
  priceCents: number
  sessionsPerMonth: number | null
  billingDay: number
  startedOn: string
}

/** A assinatura ativa do cliente, se houver — o índice parcial garante que é no máximo uma. */
export async function assinaturaAtiva(
  db: Cliente,
  tenantId: string,
  clientId: string,
): Promise<AssinaturaDoCliente | null> {
  const { data, error } = await db
    .from('client_subscriptions')
    .select('id, billing_day, started_on, subscription_plans(name, price_cents, sessions_per_month)')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data?.subscription_plans) return null

  return {
    id: data.id,
    planName: data.subscription_plans.name,
    priceCents: data.subscription_plans.price_cents,
    sessionsPerMonth: data.subscription_plans.sessions_per_month,
    billingDay: data.billing_day,
    startedOn: data.started_on,
  }
}

export async function assinar(
  db: Cliente,
  tenantId: string,
  clientId: string,
  entrada: z.infer<typeof EsquemaAssinatura>,
) {
  const { data, error } = await db
    .from('client_subscriptions')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      plan_id: entrada.planId,
      billing_day: entrada.billingDay,
    })
    .select('id')
    .single()

  // 23505 = o índice parcial `client_subscriptions_uma_ativa` barrou uma segunda assinatura.
  if (error?.code === '23505') {
    throw AppError.validacao({ planId: 'Esse cliente já tem uma assinatura ativa. Cancele a atual antes.' })
  }
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

/**
 * Cancelar é mudar o estado e datar, nunca apagar (regra 11): o histórico precisa mostrar que a
 * pessoa foi assinante entre tais meses — é o que explica a receita daquele período.
 */
export async function cancelarAssinatura(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db
    .from('client_subscriptions')
    .update({ status: 'canceled', canceled_on: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa assinatura não está mais ativa.' })
  return data
}
