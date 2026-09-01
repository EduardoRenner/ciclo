import { z } from 'zod'

import { criarAgendamento } from '@/server/services/agendamentos'
import { enviarComFallback } from '@/server/services/mensageria'
import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'
import { AppError } from '@/server/http/errors'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const ESCOPO_TOKEN = 'lista_espera'
const EXCLUSIVIDADE_MINUTOS = 20

/**
 * O token carrega a oferta inteira (não só o id da entrada na lista): quem
 * clica no link não tem como saber qual serviço/profissional/horário foi
 * oferecido de outro jeito, e abrir uma tabela só para guardar "qual foi a
 * última oferta" duplicaria o que o próprio token já consegue carregar
 * assinado. `escopo` do `gerarTokenAssinado` continua sendo a string fixa;
 * o "id" dele é esta oferta inteira, codificada.
 */
type OfertaEncaixe = {
  waitlistId: string
  tenantId: string
  serviceId: string
  professionalId: string
  startsAt: string
  timezone: string
}

function codificarOferta(o: OfertaEncaixe): string {
  return Buffer.from(JSON.stringify(o), 'utf8').toString('base64url')
}

function decodificarOferta(codificado: string): OfertaEncaixe | null {
  try {
    return JSON.parse(Buffer.from(codificado, 'base64url').toString('utf8')) as OfertaEncaixe
  } catch {
    return null
  }
}

export const EsquemaEntrarListaEspera = z.object({
  clientId: z.uuid('Escolha a cliente.'),
  serviceId: z.uuid('Escolha o serviço.'),
  professionalId: z.uuid().nullish(),
  earliestAt: z.iso.datetime({ offset: true }).nullish(),
  latestAt: z.iso.datetime({ offset: true }).nullish(),
  /** 0 = domingo, mesma convenção de `business_hours.weekday`. */
  weekdays: z.array(z.int().min(0).max(6)).nullish(),
  periodOfDay: z.enum(['morning', 'afternoon', 'evening']).nullish(),
})

export async function entrarNaLista(db: Cliente, tenantId: string, entrada: z.infer<typeof EsquemaEntrarListaEspera>) {
  const { data, error } = await db
    .from('waitlist')
    .insert({
      tenant_id: tenantId,
      client_id: entrada.clientId,
      service_id: entrada.serviceId,
      professional_id: entrada.professionalId ?? null,
      earliest_at: entrada.earliestAt ?? null,
      latest_at: entrada.latestAt ?? null,
      weekdays: entrada.weekdays ?? null,
      period_of_day: entrada.periodOfDay ?? null,
    })
    .select('id')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export async function listarListaEspera(db: Cliente, tenantId: string, serviceId?: string) {
  let consulta = db
    .from('waitlist')
    .select('id, client_id, service_id, professional_id, earliest_at, latest_at, weekdays, period_of_day, notified_at, fulfilled_at, created_at, clients ( name )')
    .eq('tenant_id', tenantId)
    .is('fulfilled_at', null)
  if (serviceId) consulta = consulta.eq('service_id', serviceId)

  const { data, error } = await consulta.order('created_at')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

export type SlotLiberado = {
  serviceId: string
  professionalId: string
  startsAt: string
  timezone: string
}

function periodoDoHorario(startsAt: string, timezone: string): 'morning' | 'afternoon' | 'evening' {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(startsAt)),
  )
  if (hora < 12) return 'morning'
  if (hora < 18) return 'afternoon'
  return 'evening'
}

type LinhaWaitlist = {
  id: string
  client_id: string
  professional_id: string | null
  earliest_at: string | null
  latest_at: string | null
  weekdays: number[] | null
  period_of_day: string | null
  notified_at: string | null
  clients: { name: string; phone_e164: string | null; email: string | null; whatsapp_opt_out: boolean } | null
  cycle_value_at_risk_cents: number
}

/**
 * E69: ordena por (1) preferência de período bater, (2) `value_at_risk_cents`
 * do ciclo (0 até o Motor de Ciclo do Sprint 3 existir — a query já busca a
 * coluna certa, então passa a valer sozinha quando `client_cycles` tiver
 * dado de verdade, sem tocar neste código de novo), (3) ordem de entrada. A
 * compatibilidade de serviço já é o filtro da consulta, não um critério de
 * desempate.
 */
function ordenarCandidatos(linhas: LinhaWaitlist[], slot: SlotLiberado): LinhaWaitlist[] {
  const periodoDoSlot = periodoDoHorario(slot.startsAt, slot.timezone)

  return [...linhas].sort((a, b) => {
    const prefA = a.period_of_day === periodoDoSlot ? 1 : 0
    const prefB = b.period_of_day === periodoDoSlot ? 1 : 0
    if (prefA !== prefB) return prefB - prefA

    if (a.cycle_value_at_risk_cents !== b.cycle_value_at_risk_cents) {
      return b.cycle_value_at_risk_cents - a.cycle_value_at_risk_cents
    }

    return 0 // ordem de entrada já vem do `order('created_at')` da consulta — sort estável preserva.
  })
}

function elegivel(linha: LinhaWaitlist, slot: SlotLiberado): boolean {
  if (linha.professional_id && linha.professional_id !== slot.professionalId) return false
  if (linha.earliest_at && slot.startsAt < linha.earliest_at) return false
  if (linha.latest_at && slot.startsAt > linha.latest_at) return false
  if (linha.weekdays && linha.weekdays.length > 0) {
    const weekdayDoSlot = new Date(slot.startsAt).getUTCDay() // aproximação; refinar no TICKET-057 se DST virar problema aqui
    if (!linha.weekdays.includes(weekdayDoSlot)) return false
  }
  // Ainda dentro da exclusividade de outra pessoa? Não oferece para mais ninguém.
  if (linha.notified_at) {
    const minutosDesdeNotificado = (Date.now() - new Date(linha.notified_at).getTime()) / 60_000
    if (minutosDesdeNotificado < EXCLUSIVIDADE_MINUTOS) return false
  }
  return true
}

/**
 * TICKET-034: avisa **uma pessoa por vez**. Chamada depois que um agendamento
 * libera (cancelamento) — não é um job agendado, é reação a um evento, então
 * não precisa de dedupe por tempo: cada cancelamento gera no máximo um aviso.
 */
export async function notificarProximoDaLista(
  db: Cliente,
  tenantId: string,
  slot: SlotLiberado,
  appUrl: string,
  provider?: MessagingProvider,
): Promise<{ notificado: boolean; waitlistId?: string }> {
  const { data: candidatos, error } = await db
    .from('waitlist')
    .select(
      'id, client_id, professional_id, earliest_at, latest_at, weekdays, period_of_day, notified_at, clients ( name, phone_e164, email, whatsapp_opt_out )',
    )
    .eq('tenant_id', tenantId)
    .eq('service_id', slot.serviceId)
    .is('fulfilled_at', null)
    .order('created_at')
  if (error) throw new AppError('INTERNAL', { cause: error })

  // `waitlist` não tem FK para `client_cycles` (é tabela derivada, sem
  // relação declarada) — o PostgREST não embeda o que não consegue navegar
  // por constraint. Busca à parte e junta em memória.
  const clientIds = (candidatos ?? []).map((c) => c.client_id)
  const { data: ciclos, error: erroCiclos } =
    clientIds.length > 0
      ? await db
          .from('client_cycles')
          .select('client_id, value_at_risk_cents')
          .eq('tenant_id', tenantId)
          .eq('service_id', slot.serviceId)
          .in('client_id', clientIds)
      : { data: [], error: null }
  if (erroCiclos) throw new AppError('INTERNAL', { cause: erroCiclos })

  const valorEmRiscoPorCliente = new Map((ciclos ?? []).map((c) => [c.client_id, c.value_at_risk_cents]))

  const linhas = (candidatos ?? []).map((c) => ({
    ...c,
    cycle_value_at_risk_cents: valorEmRiscoPorCliente.get(c.client_id) ?? 0,
  })) as unknown as LinhaWaitlist[]

  const elegiveis = linhas.filter((l) => elegivel(l, slot) && l.clients && !l.clients.whatsapp_opt_out && l.clients.phone_e164)
  const ordenados = ordenarCandidatos(elegiveis, slot)
  const escolhido = ordenados[0]
  if (!escolhido) return { notificado: false }

  const oferta: OfertaEncaixe = {
    waitlistId: escolhido.id,
    tenantId,
    serviceId: slot.serviceId,
    professionalId: slot.professionalId,
    startsAt: slot.startsAt,
    timezone: slot.timezone,
  }
  const token = gerarTokenAssinado(ESCOPO_TOKEN, codificarOferta(oferta), EXCLUSIVIDADE_MINUTOS / 60)
  const link = `${appUrl}/lista-espera/${token}`

  // §S7/P5 da auditoria de segurança (`docs/36`): `tenantId` é o parâmetro da função, o mesmo já
  // usado para filtrar `candidatos` acima — repetir aqui fecha a janela entre a checagem e esta
  // escrita, mesmo `escolhido.id` já sendo seguro hoje.
  const { error: erroNotificar } = await db
    .from('waitlist')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', escolhido.id)
    .eq('tenant_id', tenantId)
  if (erroNotificar) throw new AppError('INTERNAL', { cause: erroNotificar })

  const horario = new Date(slot.startsAt).toLocaleString('pt-BR', { timeZone: slot.timezone, dateStyle: 'short', timeStyle: 'short' })

  await enviarComFallback(
    db,
    {
      tenantId,
      clientId: escolhido.client_id,
      kind: 'transactional',
      template: 'encaixe_disponivel',
      params: { link, horario },
      fallbackSubject: 'Um horário abriu na sua lista de espera',
      fallbackBody: `Abriu um horário em ${horario}. Você tem ${EXCLUSIVIDADE_MINUTOS} minutos de exclusividade para confirmar: ${link}`,
      whatsappTo: escolhido.clients!.phone_e164!,
      emailTo: escolhido.clients!.email,
    },
    provider,
  )

  return { notificado: true, waitlistId: escolhido.id }
}

/**
 * A cliente notificada usa o link para reivindicar o encaixe — o token já
 * carrega tudo (oferta + tenant), então quem chama só precisa do token.
 * Cria o agendamento de verdade (mesma `criarAgendamento` do TICKET-021 —
 * se alguém mais já pegou o horário nesse meio-tempo, a exclusion constraint
 * recusa igual recusaria qualquer outra tentativa) e marca a entrada da
 * lista como atendida.
 */
export async function reivindicarEncaixe(db: Cliente, token: string) {
  const codificado = verificarTokenAssinado(ESCOPO_TOKEN, token)
  if (!codificado) throw new AppError('NOT_FOUND', { message: 'Esse link de encaixe não é mais válido.' })

  const oferta = decodificarOferta(codificado)
  if (!oferta) throw new AppError('NOT_FOUND', { message: 'Esse link de encaixe não é mais válido.' })

  const { data: entrada, error } = await db
    .from('waitlist')
    .select('client_id, fulfilled_at')
    .eq('id', oferta.waitlistId)
    .eq('tenant_id', oferta.tenantId)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!entrada) throw new AppError('NOT_FOUND', { message: 'Esse link de encaixe não é mais válido.' })
  if (entrada.fulfilled_at) throw new AppError('NOT_FOUND', { message: 'Esse encaixe já foi usado.' })

  const { data: tenantRow, error: erroTenant } = await db
    .from('tenants')
    .select('settings')
    .eq('id', oferta.tenantId)
    .maybeSingle()
  if (erroTenant) throw new AppError('INTERNAL', { cause: erroTenant })
  if (!tenantRow) throw new AppError('NOT_FOUND', { message: 'Esse encaixe não existe mais.' })

  const agendamento = await criarAgendamento(
    db,
    oferta.tenantId,
    oferta.timezone,
    null,
    {
      clientId: entrada.client_id,
      serviceId: oferta.serviceId,
      professionalId: oferta.professionalId,
      startsAt: oferta.startsAt,
      origin: 'waitlist',
      note: null,
    },
    tenantRow.settings,
  )

  // §S7/P5 (`docs/36`): `oferta.tenantId` vem do token assinado (HMAC), a mesma fonte que já
  // filtrou `entrada` acima — repetir aqui fecha a janela entre a checagem e esta escrita.
  const { error: erroFulfil } = await db
    .from('waitlist')
    .update({ fulfilled_at: new Date().toISOString() })
    .eq('id', oferta.waitlistId)
    .eq('tenant_id', oferta.tenantId)
  if (erroFulfil) throw new AppError('INTERNAL', { cause: erroFulfil })

  return agendamento
}
