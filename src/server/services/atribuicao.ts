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
  campaignId: string | null
}

export type ReceitaAtribuida = {
  totalCents: number
  count: number
  items: ItemReceitaAtribuida[]
  /**
   * Quantas mensagens de campanha PODERIAM ter produzido os retornos contados em `count` — as
   * enviadas dentro da mesma janela de busca (o período pedido, mais a folga de 30 dias antes).
   *
   * Existe porque a tela de campanhas comparava `count` (do mês) com a soma de
   * `campaigns.sent_count` de TODAS as campanhas de sempre, e escrevia "N de M mensagens já
   * enviadas". Numerador de um mês sobre denominador de toda a história: numa conta com 47
   * mensagens acumuladas e 3 retornos no mês, o salão lia que campanha converte 6% — quando a
   * campanha que produziu aqueles retornos pode ter convertido 30%. O produto depreciando a si
   * mesmo por comparar duas janelas diferentes como se fossem uma.
   */
  mensagensNaJanela: number
}

/**
 * TICKET-039. §2.4 quer "o CICLO trouxe R$ X este mês" — soma `desde`/`ate` (o mês corrente,
 * normalmente) usando `atribuirReceita` (`core/attribution`). Busca campanhas com folga de
 * `JANELA_DIAS` ANTES de `desde`: uma campanha enviada em 25/jul pode ter gerado um agendamento
 * em 3/ago, que cai dentro do mês corrente mas cuja campanha não cairia se a busca começasse
 * exatamente em `desde`.
 *
 * Valor em centavos vem de `appointments.price_cents` (preço congelado na criação), não de
 * `tickets.total_cents`.
 *
 * **A instrução que estava aqui dizia para revisar "quando o TICKET-042 existir". Ele existe —
 * `comanda.ts` e `ticket_items` estão no ar — e a revisão, feita, concluiu o contrário: continua
 * `price_cents`.** Medido em 2026-09-05:
 *
 *   1. `concluirAgendamento` cria a comanda com `status = 'open'` e `total_cents = 0` (default da
 *      `0001`). O total só passa a existir quando alguém FECHA a comanda.
 *   2. Fechar comanda é o módulo `register`, que começa no **Essencial** (`core/billing/planos.ts`).
 *      O plano **Grátis** tem `cycle_engine` e não tem `register`.
 *
 * Ou seja: trocar a fonte zeraria "o Motor trouxe R$ X" **exatamente para o tenant do Grátis** —
 * que é justamente quem esse número precisa convencer a assinar. Uma leitura mecânica da
 * instrução antiga teria trocado um número imperfeito por um número zero, na tela que sustenta o
 * preço do produto.
 *
 * O que `price_cents` custa, dito para não virar promessa: é preço de tabela, então não enxerga
 * desconto dado na comanda, item extra nem gorjeta — a mesma distinção que
 * `numero-de-hoje-nao-e-faturamento` guarda na tela Hoje. Usar o total real onde ele existe e cair
 * para o preço de tabela onde não existe é possível, mas é decisão de produto (mistura duas
 * réguas no mesmo somatório), não troca de coluna. Registrado em `docs/DECISOES.md`.
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

  const hoje = Temporal.Now.plainDateISO().toString()

  const [mensagens, agendamentos, assinaturasAtivas, pacotesComSaldo] = await Promise.all([
    db
      .from('messages')
      .select('client_id, sent_at, campaign_id')
      .eq('tenant_id', tenantId)
      .eq('kind', 'campaign')
      .eq('status', 'sent')
      .gte('sent_at', inicioBuscaInstante)
      .lt('sent_at', fimBuscaInstante),
    db
      .from('appointments')
      .select('id, client_id, service_id, created_at, price_cents, clients(name)')
      .eq('tenant_id', tenantId)
      .eq('status', 'done')
      .gte('created_at', inicioBuscaInstante)
      .lt('created_at', fimBuscaInstante),
    /*
      `docs/DECISOES.md` 2026-09-18, mesma classe do achado em `ciclo.ts`: `appointments.price_cents`
      congela o preço de CATÁLOGO na criação, mesmo para quem tem assinatura ativa do clube — cuja
      visita não gera aquela venda avulsa (`server/services/clube.ts`). Sem este filtro, "o Motor
      trouxe R$X este mês" contaria como receita NOVA uma visita que o assinante já tinha pago via
      mensalidade, mesmo que a campanha tenha de fato motivado a volta.
    */
    db.from('client_subscriptions').select('client_id').eq('tenant_id', tenantId).eq('status', 'active'),
    // Mesma classe, terceiro mecanismo (`docs/DECISOES.md` 2026-09-18, achado seguinte): pacote
    // com sessão sobrando, por (cliente, serviço) — mesma granularidade de `ciclo.ts`.
    db
      .from('packages')
      .select('client_id, service_id, total_sessions, used_sessions')
      .eq('tenant_id', tenantId)
      .or(`expires_on.is.null,expires_on.gte.${hoje}`),
  ])
  if (mensagens.error) throw new AppError('INTERNAL', { cause: mensagens.error })
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })
  if (assinaturasAtivas.error) throw new AppError('INTERNAL', { cause: assinaturasAtivas.error })
  if (pacotesComSaldo.error) throw new AppError('INTERNAL', { cause: pacotesComSaldo.error })

  const assinantesAtivos = new Set((assinaturasAtivas.data ?? []).map((a) => a.client_id))
  const combinacoesComPacote = new Set(
    (pacotesComSaldo.data ?? []).filter((p) => p.used_sessions < p.total_sessions).map((p) => `${p.client_id}:${p.service_id}`),
  )

  const campanhas: CampanhaEnviada[] = (mensagens.data ?? [])
    .filter((m): m is { client_id: string; sent_at: string; campaign_id: string | null } => m.client_id !== null && m.sent_at !== null)
    .map((m) => ({ clientId: m.client_id, sentAt: Temporal.Instant.from(m.sent_at), campaignId: m.campaign_id }))

  const nomePorCliente = new Map<string, string>()
  const elegiveis: AgendamentoElegivel[] = []
  for (const ag of agendamentos.data ?? []) {
    if (!ag.client_id) continue
    const cliente = ag.clients as { name: string } | null
    nomePorCliente.set(ag.client_id, cliente?.name ?? '')
    const semVendaAvulsa = assinantesAtivos.has(ag.client_id) || combinacoesComPacote.has(`${ag.client_id}:${ag.service_id}`)
    elegiveis.push({
      id: ag.id,
      clientId: ag.client_id,
      createdAt: Temporal.Instant.from(ag.created_at),
      valueCents: semVendaAvulsa ? 0 : ag.price_cents,
    })
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
    mensagensNaJanela: campanhas.length,
    items: atribuicoes.map((a) => ({
      appointmentId: a.appointmentId,
      clientId: a.clientId,
      clientName: nomePorCliente.get(a.clientId) ?? '',
      valueCents: a.valueCents,
      campaignSentAt: a.campaignSentAt.toString(),
      campaignId: a.campaignId,
    })),
  }
}

export type ResultadoPorCampanha = { bookedCount: number; revenueCents: number }

/**
 * TICKET-039/09-PLATAFORMA §continuação, migration 0054: `campaigns.booked_count`/`revenue_cents`
 * nunca tiveram escritor de propósito ("quem preenche é a atribuição, não o usuário") — a
 * campanha lida hoje precisa do número de VERDADE ao lado, não de um contador de dígito digitado.
 *
 * Diferente de `receitaAtribuidaAoCiclo` (mês corrente, para "quanto o CICLO trouxe"): aqui não há
 * janela de data — uma campanha de 3 meses atrás continua sendo um cartão permanente na tela, não
 * um relatório mensal, então o total dela não pode sumir quando o mês vira. `atribuirReceita`
 * ainda roda sobre o conjunto INTEIRO de mensagens/agendamentos do tenant (a prioridade por
 * campanha mais antiga é a mesma regra de sempre) — só o agrupamento final é por `campaignId`.
 */

/**
 * Nota de transição: a busca já filtra `campaign_id is not null`, então mensagens de campanha
 * enviadas ANTES da migration 0054 (sem o vínculo) não entram nesta prioridade — um agendamento
 * que uma campanha antiga teria reivindicado primeiro pode, por um tempo, aparecer atribuído a
 * uma campanha mais nova aqui. Passa sozinho conforme mensagem antiga sai da janela de 30 dias de
 * qualquer atribuição; não é uma discrepância permanente, e forçar as duas contas a baterem 100%
 * durante a transição custaria mais do que vale.
 */
export async function receitaPorCampanha(db: Cliente, tenantId: string): Promise<Map<string, ResultadoPorCampanha>> {
  const hoje = Temporal.Now.plainDateISO().toString()

  const [mensagens, agendamentos, assinaturasAtivas, pacotesComSaldo] = await Promise.all([
    db.from('messages').select('client_id, sent_at, campaign_id').eq('tenant_id', tenantId).eq('kind', 'campaign').eq('status', 'sent').not('campaign_id', 'is', null),
    db.from('appointments').select('id, client_id, service_id, created_at, price_cents').eq('tenant_id', tenantId).eq('status', 'done'),
    // Mesmo motivo de `receitaAtribuidaAoCiclo`, acima: assinante ativo não gera venda avulsa.
    db.from('client_subscriptions').select('client_id').eq('tenant_id', tenantId).eq('status', 'active'),
    // Mesmo motivo, terceiro mecanismo: pacote com sessão sobrando, por (cliente, serviço).
    db
      .from('packages')
      .select('client_id, service_id, total_sessions, used_sessions')
      .eq('tenant_id', tenantId)
      .or(`expires_on.is.null,expires_on.gte.${hoje}`),
  ])
  if (mensagens.error) throw new AppError('INTERNAL', { cause: mensagens.error })
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })
  if (assinaturasAtivas.error) throw new AppError('INTERNAL', { cause: assinaturasAtivas.error })
  if (pacotesComSaldo.error) throw new AppError('INTERNAL', { cause: pacotesComSaldo.error })

  const assinantesAtivos = new Set((assinaturasAtivas.data ?? []).map((a) => a.client_id))
  const combinacoesComPacote = new Set(
    (pacotesComSaldo.data ?? []).filter((p) => p.used_sessions < p.total_sessions).map((p) => `${p.client_id}:${p.service_id}`),
  )

  const campanhas: CampanhaEnviada[] = (mensagens.data ?? [])
    .filter((m): m is { client_id: string; sent_at: string; campaign_id: string } => m.client_id !== null && m.sent_at !== null && m.campaign_id !== null)
    .map((m) => ({ clientId: m.client_id, sentAt: Temporal.Instant.from(m.sent_at), campaignId: m.campaign_id }))

  const elegiveis: AgendamentoElegivel[] = (agendamentos.data ?? [])
    .filter((ag): ag is typeof ag & { client_id: string } => ag.client_id !== null)
    .map((ag) => ({
      id: ag.id,
      clientId: ag.client_id,
      createdAt: Temporal.Instant.from(ag.created_at),
      valueCents: assinantesAtivos.has(ag.client_id) || combinacoesComPacote.has(`${ag.client_id}:${ag.service_id}`) ? 0 : ag.price_cents,
    }))

  const resultado = new Map<string, ResultadoPorCampanha>()
  for (const a of atribuirReceita(campanhas, elegiveis)) {
    if (!a.campaignId) continue
    const atual = resultado.get(a.campaignId) ?? { bookedCount: 0, revenueCents: 0 }
    resultado.set(a.campaignId, { bookedCount: atual.bookedCount + 1, revenueCents: atual.revenueCents + a.valueCents })
  }
  return resultado
}
