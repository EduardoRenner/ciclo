import { Temporal } from '@js-temporal/polyfill'

export type CampanhaEnviada = {
  clientId: string
  sentAt: Temporal.Instant
  /**
   * `null` cobre mensagem antiga, enviada antes de `messages.campaign_id` existir (migration
   * 0054) — continua contando pro agregado do tenant, só não entra na quebra por campanha.
   */
  campaignId: string | null
}

export type AgendamentoElegivel = {
  id: string
  clientId: string
  createdAt: Temporal.Instant
  valueCents: number
}

export type AtribuicaoReceita = {
  appointmentId: string
  clientId: string
  valueCents: number
  campaignSentAt: Temporal.Instant
  campaignId: string | null
}

const JANELA_DIAS_PADRAO = 30

/**
 * TICKET-039. "Ligar agendamento originado de campanha → receita" sem link de rastreio no
 * booking (fora de escopo do MVP): a atribuição é por tempo — o primeiro agendamento que o
 * cliente cria depois de receber uma campanha, dentro da janela, é o que ela "trouxe". Cada
 * campanha atribui no máximo um agendamento, e cada agendamento é atribuído a no máximo uma
 * campanha (a mais antiga que ainda tinha um agendamento livre para reivindicar) — sem isso um
 * cliente que recebe 3 campanhas e agenda uma vez só contaria receita 3x.
 */
export function atribuirReceita(
  campanhas: CampanhaEnviada[],
  agendamentos: AgendamentoElegivel[],
  janelaDias: number = JANELA_DIAS_PADRAO,
): AtribuicaoReceita[] {
  const porCliente = new Map<string, AgendamentoElegivel[]>()
  for (const ag of agendamentos) {
    const lista = porCliente.get(ag.clientId) ?? []
    lista.push(ag)
    porCliente.set(ag.clientId, lista)
  }
  for (const lista of porCliente.values()) {
    lista.sort((a, b) => Temporal.Instant.compare(a.createdAt, b.createdAt))
  }

  const campanhasOrdenadas = [...campanhas].sort((a, b) => Temporal.Instant.compare(a.sentAt, b.sentAt))
  const reivindicados = new Set<string>()
  const resultado: AtribuicaoReceita[] = []

  for (const campanha of campanhasOrdenadas) {
    const candidatos = porCliente.get(campanha.clientId) ?? []
    const limite = campanha.sentAt.add({ hours: janelaDias * 24 })

    const alvo = candidatos.find(
      (ag) => !reivindicados.has(ag.id) && Temporal.Instant.compare(ag.createdAt, campanha.sentAt) > 0 && Temporal.Instant.compare(ag.createdAt, limite) <= 0,
    )
    if (!alvo) continue

    reivindicados.add(alvo.id)
    resultado.push({ appointmentId: alvo.id, clientId: alvo.clientId, valueCents: alvo.valueCents, campaignSentAt: campanha.sentAt, campaignId: campanha.campaignId })
  }

  return resultado
}
