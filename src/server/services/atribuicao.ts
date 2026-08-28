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
export async function receitaAtribuidaAoCiclo(
  db: Cliente,
  tenantId: string,
  timezone: string,
  desde: string,
  ate: string,
): Promise<ReceitaAtribuida> {
  /*
   * Auditoria de 2026-08-28, mesma classe do extrato de comissão. Os TRÊS chamadores já montam
   * `desde`/`ate` com `Temporal.Now.zonedDateTimeISO(timezone)` — eles falam o calendário do
   * salão. Era esta função que reinterpretava aquelas datas como se fossem UTC, no filtro
   * (`T00:00:00Z` / `T23:59:59Z`) e na janela (`timeZone: 'UTC'`).
   *
   * Em Brasília isso desloca o mês em três horas: agendamento criado depois das 21h do último dia
   * do mês entra no mês seguinte, e as três primeiras horas do dia 1º ainda contam para o mês
   * anterior. O número aparece como "o CICLO trouxe R$ X este mês" na tela inicial do painel,
   * ao lado do caixa — que conta o mês no fuso do salão desde o TICKET-047. Dois "este mês"
   * diferentes na mesma sessão.
   *
   * `lte '23:59:59'` some junto: intervalo semiaberto, como no `caixa.ts`.
   */
  const inicioBusca = Temporal.PlainDate.from(desde).subtract({ days: JANELA_DIAS }).toString()
  const inicioBuscaInstante = Temporal.PlainDate.from(inicioBusca).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fimBuscaInstante = Temporal.PlainDate.from(ate).add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const [mensagens, agendamentos] = await Promise.all([
    db
      .from('messages')
      .select('client_id, sent_at')
      .eq('tenant_id', tenantId)
      .eq('kind', 'campaign')
      .eq('status', 'sent')
      .gte('sent_at', inicioBuscaInstante)
      .lt('sent_at', fimBuscaInstante),
    db
      .from('appointments')
      .select('id, client_id, created_at, price_cents, clients(name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .gte('created_at', inicioBuscaInstante)
      .lt('created_at', fimBuscaInstante),
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

  const inicioJanela = Temporal.PlainDate.from(desde).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()
  const fimJanela = Temporal.PlainDate.from(ate).add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()

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
