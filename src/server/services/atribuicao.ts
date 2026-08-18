import { Temporal } from '@js-temporal/polyfill'

import { atribuirReceita, type AgendamentoElegivel, type CampanhaEnviada } from '@/core/attribution/compute'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const JANELA_DIAS = 30

export type ItemReceitaAtribuida = {
  appointmentId: string
  clientId: string
  clientName: string
  valueCents: number
  campaignSentAt: string
}

export type ReceitaAtribuida = {
  totalCents: number
  count: number
  items: ItemReceitaAtribuida[]
}

/**
 * TICKET-039. §2.4 quer "o CICLO trouxe R$ X este mês" — soma `desde`/`ate` (o mês corrente,
 * normalmente) usando `atribuirReceita` (`core/attribution`). Busca campanhas com folga de
 * `JANELA_DIAS` ANTES de `desde`: uma campanha enviada em 25/jul pode ter gerado um agendamento
 * em 3/ago, que cai dentro do mês corrente mas cuja campanha não cairia se a busca começasse
 * exatamente em `desde`.
 *
 * Valor em centavos vem de `appointments.price_cents` (preço congelado na criação), não de
 * `tickets.total_cents` — o TICKET-042 (comanda com itens de verdade) ainda não existe nesta
 * base; quando existir, revisar para usar o total real da comanda fechada.
 */
export async function receitaAtribuidaAoCiclo(db: Cliente, tenantId: string, desde: string, ate: string): Promise<ReceitaAtribuida> {
  const inicioBusca = Temporal.PlainDate.from(desde).subtract({ days: JANELA_DIAS }).toString()

  const [mensagens, agendamentos] = await Promise.all([
    db
      .from('messages')
      .select('client_id, sent_at')
      .eq('tenant_id', tenantId)
      .eq('kind', 'campaign')
      .eq('status', 'sent')
      .gte('sent_at', `${inicioBusca}T00:00:00Z`)
      .lte('sent_at', `${ate}T23:59:59Z`),
    db
      .from('appointments')
      .select('id, client_id, created_at, price_cents, clients(name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .gte('created_at', `${inicioBusca}T00:00:00Z`)
      .lte('created_at', `${ate}T23:59:59Z`),
  ])
  if (mensagens.error) throw new AppError('INTERNAL', { cause: mensagens.error })
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })

  const campanhas: CampanhaEnviada[] = (mensagens.data ?? [])
    .filter((m): m is { client_id: string; sent_at: string } => m.client_id !== null && m.sent_at !== null)
    .map((m) => ({ clientId: m.client_id, sentAt: Temporal.Instant.from(m.sent_at) }))

  const nomePorCliente = new Map<string, string>()
  const elegiveis: AgendamentoElegivel[] = []
  for (const ag of agendamentos.data ?? []) {
    if (!ag.client_id) continue
    const cliente = ag.clients as { name: string } | null
    nomePorCliente.set(ag.client_id, cliente?.name ?? '')
    elegiveis.push({ id: ag.id, clientId: ag.client_id, createdAt: Temporal.Instant.from(ag.created_at), valueCents: ag.price_cents })
  }

  const inicioJanela = Temporal.PlainDate.from(desde).toZonedDateTime({ timeZone: 'UTC' }).toInstant()
  const fimJanela = Temporal.PlainDate.from(ate).add({ days: 1 }).toZonedDateTime({ timeZone: 'UTC' }).toInstant()

  // A busca trouxe campanhas com folga de `JANELA_DIAS` antes de `desde` só para não perder
  // campanha antiga com efeito tardio — o agendamento em si tem que cair DENTRO do período
  // pedido, senão a mesma receita apareceria também no relatório do mês anterior.
  const atribuicoes = atribuirReceita(campanhas, elegiveis).filter((a) => {
    const ag = elegiveis.find((e) => e.id === a.appointmentId)!
    return Temporal.Instant.compare(ag.createdAt, inicioJanela) >= 0 && Temporal.Instant.compare(ag.createdAt, fimJanela) < 0
  })

  return {
    totalCents: atribuicoes.reduce((soma, a) => soma + a.valueCents, 0),
    count: atribuicoes.length,
    items: atribuicoes.map((a) => ({
      appointmentId: a.appointmentId,
      clientId: a.clientId,
      clientName: nomePorCliente.get(a.clientId) ?? '',
      valueCents: a.valueCents,
      campaignSentAt: a.campaignSentAt.toString(),
    })),
  }
}
