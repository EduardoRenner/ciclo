import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'
import { enviarComFallback } from '@/server/services/mensageria'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type EstadoCiclo = Database['public']['Enums']['cycle_state']

export type ItemRecuperar = {
  clientId: string
  serviceId: string
  name: string
  phone: string | null
  serviceName: string
  state: EstadoCiclo
  lateDays: number
  valueCents: number
  lastCampaignAt: string | null
}

export type ListaRecuperar = {
  totalValueCents: number
  count: number
  items: ItemRecuperar[]
}

const LIMITE_PADRAO = 200

/**
 * §2.4: `GET /cycle/recover`. `v_recover_revenue` (0001) já filtra para os
 * quatro estados que valem a pena mostrar (`on_track` nunca aparece aqui) e
 * já vem ordenada por `value_at_risk_cents desc` — não precisa reordenar.
 * `totalValueCents`/`count` somam o filtro inteiro, não só a página que a
 * UI recebe: a profissional precisa do número certo mesmo pedindo `limit=20`.
 */
export async function listarParaRecuperar(
  db: Cliente,
  tenantId: string,
  opcoes: { state?: EstadoCiclo; limit?: number } = {},
): Promise<ListaRecuperar> {
  let consulta = db.from('v_recover_revenue').select('*').eq('tenant_id', tenantId)
  if (opcoes.state) consulta = consulta.eq('state', opcoes.state)

  const { data, error } = await consulta
  if (error) throw new AppError('INTERNAL', { cause: error })

  // A view não declara FK nem `not null` para o PostgREST/gerador de tipos,
  // mas toda coluna aqui vem de `join`s obrigatórios sobre colunas `not null`
  // (0001) — o `!` é seguro, não uma aposta.
  const linhas = data ?? []
  const totalValueCents = linhas.reduce((soma, l) => soma + l.value_at_risk_cents!, 0)
  const limite = opcoes.limit ?? LIMITE_PADRAO

  return {
    totalValueCents,
    count: linhas.length,
    items: linhas.slice(0, limite).map((l) => ({
      clientId: l.client_id!,
      serviceId: l.service_id!,
      name: l.client_name!,
      phone: l.phone_e164,
      serviceName: l.service_name!,
      state: l.state!,
      lateDays: l.late_days!,
      valueCents: l.value_at_risk_cents!,
      lastCampaignAt: l.last_campaign_at,
    })),
  }
}

export const EsquemaEnviarRecuperar = z.object({
  items: z.array(z.object({ clientId: z.string().uuid(), serviceId: z.string().uuid() })).min(1).max(200),
  mode: z.enum(['ai', 'template']),
  templateId: z.string().optional(),
})
export type EntradaEnviarRecuperar = z.infer<typeof EsquemaEnviarRecuperar>

type MotivoPulado = 'opt_out' | 'rate_limited'

export type ResultadoEnviarRecuperar = {
  queued: number
  skipped: { clientId: string; reason: MotivoPulado }[]
}

const DIAS_ENTRE_CAMPANHAS = 7
const JANELA_PERMITIDA_INICIO = 8
const JANELA_PERMITIDA_FIM = 21

/**
 * §7, "limites de mensagem": aqui aplicados por linha (client × service), não
 * pelo job diário do TICKET-038 — esta é a ação manual "mandar agora" da
 * tela. Reaproveita a mesma regra de 7 dias porque é a única que faz sentido
 * checar sem o histórico da semana inteira que só o job acumula.
 *
 * `mode: 'ai'` ainda não tem geração de texto (fora de escopo do MVP puro —
 * `01-ESPEC §5.3` não descreve o gerador); cai no mesmo template genérico de
 * recuperação até existir. Decisão em `docs/DECISOES.md`.
 */
export async function enviarParaRecuperar(
  db: Cliente,
  tenantId: string,
  timezone: string,
  entrada: EntradaEnviarRecuperar,
  provider: MessagingProvider = new WhatsAppCloudProvider(),
  // Parâmetro, não `Temporal.Now` direto: um teste que roda às 21h40 (fora da
  // janela 8h–21h) não pode depender da hora real em que ele acontece de
  // rodar — mesmo bug de determinismo já registrado no TICKET-030.
  agora: Temporal.Instant = Temporal.Now.instant(),
): Promise<ResultadoEnviarRecuperar> {
  const agoraLocal = agora.toZonedDateTimeISO(timezone)
  const dentroDaJanela = agoraLocal.hour >= JANELA_PERMITIDA_INICIO && agoraLocal.hour < JANELA_PERMITIDA_FIM

  const skipped: ResultadoEnviarRecuperar['skipped'] = []
  let queued = 0

  for (const item of entrada.items) {
    const { data: linha, error: erroCiclo } = await db
      .from('client_cycles')
      .select('last_campaign_at, state, value_at_risk_cents')
      .eq('tenant_id', tenantId)
      .eq('client_id', item.clientId)
      .eq('service_id', item.serviceId)
      .maybeSingle()
    if (erroCiclo) throw new AppError('INTERNAL', { cause: erroCiclo })
    if (!linha) continue // já não está mais em risco (concluiu, cancelou) — nada a enviar

    const emJanelaDeDedupe =
      !dentroDaJanela ||
      (linha.last_campaign_at !== null &&
        agora.since(Temporal.Instant.from(linha.last_campaign_at)).total('days') < DIAS_ENTRE_CAMPANHAS)
    if (emJanelaDeDedupe) {
      skipped.push({ clientId: item.clientId, reason: 'rate_limited' })
      continue
    }

    const { data: cliente, error: erroCliente } = await db
      .from('clients')
      .select('name, phone_e164, email, whatsapp_opt_out')
      .eq('id', item.clientId)
      .single()
    if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
    if (cliente.whatsapp_opt_out || !cliente.phone_e164) {
      skipped.push({ clientId: item.clientId, reason: 'opt_out' })
      continue
    }

    const { data: servico, error: erroServico } = await db.from('services').select('name').eq('id', item.serviceId).single()
    if (erroServico) throw new AppError('INTERNAL', { cause: erroServico })

    const resultado = await enviarComFallback(db, {
      tenantId,
      clientId: item.clientId,
      kind: 'campaign',
      template: entrada.templateId ?? 'recover_client',
      params: { name: cliente.name, service: servico.name },
      fallbackSubject: `Sentimos sua falta, ${cliente.name}!`,
      fallbackBody: `Já faz um tempo desde seu último ${servico.name}. Vamos marcar um novo horário?`,
      whatsappTo: cliente.phone_e164,
      emailTo: cliente.email,
    }, provider)

    if (resultado.status === 'sent') {
      const { error: erroUpdate } = await db
        .from('client_cycles')
        .update({ last_campaign_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('client_id', item.clientId)
        .eq('service_id', item.serviceId)
      if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })
      queued++
    } else {
      // Falha de entrega de verdade (WhatsApp e e-mail indisponíveis) não é
      // nem opt-out nem limite de taxa, mas §2.4 só define esses dois
      // motivos — `rate_limited` é o mais próximo: a UI já sabe reoferecer
      // "tentar de novo" para esse motivo, o que é a ação certa aqui.
      skipped.push({ clientId: item.clientId, reason: 'rate_limited' })
    }
  }

  return { queued, skipped }
}
