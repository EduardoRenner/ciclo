import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { availableSlots, type IntervaloExpediente, type IntervaloOcupado } from '@/core/scheduling/available-slots'
import { transicaoValida, type EstadoAgendamento } from '@/core/scheduling/state'
import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const COLUNAS =
  'id, tenant_id, client_id, professional_id, service_id, starts_at, ends_at, status, origin, price_cents, confirmed_at, arrived_at, completed_at, canceled_at, canceled_by, cancel_reason, client_note'

export const EsquemaCriarAgendamento = z
  .object({
    clientId: z.uuid().nullish(),
    clientDraft: z
      .object({
        name: z.string().trim().min(2, 'Digite o nome da cliente.'),
        phone: z.string().trim().min(1, 'Digite o telefone da cliente.'),
      })
      .nullish(),
    serviceId: z.uuid('Escolha um serviço.'),
    professionalId: z.uuid('Escolha um profissional.'),
    startsAt: z.iso.datetime({ message: 'Horário inválido.' }),
    origin: z.enum(['app', 'public_page', 'whatsapp', 'recurring', 'waitlist', 'import']).default('app'),
    note: z.string().trim().max(500, 'Nota muito longa.').nullish(),
  })
  .refine((d) => d.clientId ?? d.clientDraft, {
    message: 'Informe a cliente já cadastrada ou os dados dela.',
    path: ['clientId'],
  })

export const EsquemaRemarcar = z.object({
  startsAt: z.iso.datetime({ message: 'Horário inválido.' }).nullish(),
  professionalId: z.uuid().nullish(),
  note: z.string().trim().max(500).nullish(),
})

export const EsquemaCancelar = z.object({
  reason: z.string().trim().max(500).nullish(),
  canceledBy: z.enum(['client', 'professional', 'system']),
})

type EntradaCriar = z.infer<typeof EsquemaCriarAgendamento>

/** Resolve `clientId` ou cria a partir de `clientDraft`, reaproveitando cliente existente pelo telefone. */
async function resolverCliente(db: Cliente, tenantId: string, entrada: EntradaCriar): Promise<string> {
  if (entrada.clientId) {
    const { data, error } = await db
      .from('clients')
      .select('id')
      .eq('id', entrada.clientId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!data) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
    return data.id
  }

  const draft = entrada.clientDraft!
  const e164 = normalizarTelefoneBR(draft.phone)
  if (!e164) throw AppError.validacao({ 'clientDraft.phone': 'Telefone inválido. Confira o DDD e o número.' })

  const hash = hashTelefone(e164)
  const { data: existente, error: erroExistente } = await db
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_hash', hash)
    .is('deleted_at', null)
    .maybeSingle()
  if (erroExistente) throw new AppError('INTERNAL', { cause: erroExistente })
  if (existente) return existente.id

  const { data: criado, error: erroCriar } = await db
    .from('clients')
    .insert({ tenant_id: tenantId, name: draft.name, phone_e164: e164, phone_hash: hash, source: 'agenda' })
    .select('id')
    .single()
  if (erroCriar) throw new AppError('INTERNAL', { cause: erroCriar })
  return criado.id
}

type ServicoAgendavel = { duration_min: number; price_cents: number; parallel_capacity: number }

async function servicoDoTenant(db: Cliente, tenantId: string, serviceId: string): Promise<ServicoAgendavel> {
  const { data, error } = await db
    .from('services')
    .select('duration_min, price_cents, parallel_capacity')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw AppError.validacao({ serviceId: 'Esse serviço não está mais disponível.' })
  return data
}

async function profissionalDoTenant(db: Cliente, tenantId: string, professionalId: string): Promise<void> {
  const { data, error } = await db
    .from('professionals')
    .select('id')
    .eq('id', professionalId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw AppError.validacao({ professionalId: 'Esse profissional não está mais disponível.' })
}

/** Postgres/`business_hours.weekday`: 0 = domingo. `Temporal.dayOfWeek`: 1 = segunda … 7 = domingo. */
function weekdayPg(dia: Temporal.PlainDate): number {
  return dia.dayOfWeek % 7
}

/**
 * Carrega expediente, folgas e agendamentos de um profissional numa janela de
 * dias e devolve `availableSlots()` de cada dia — é o motor do TICKET-020
 * alimentado com dado de verdade, usado tanto para calcular as 3 alternativas
 * do 409 (E71) quanto, futuramente, para `GET /availability`.
 */
async function slotsDaJanela(
  db: Cliente,
  tenantId: string,
  professionalId: string,
  timezone: string,
  servico: ServicoAgendavel,
  primeiroDia: Temporal.PlainDate,
  numeroDeDias: number,
  now: string,
  config: { minLeadTimeMinutes: number; maxAdvanceDays: number; slotGranularityMin: number },
): Promise<string[]> {
  const ultimoDia = primeiroDia.add({ days: numeroDeDias - 1 })
  const inicioJanela = primeiroDia.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fimJanela = ultimoDia.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const [horarios, folgas, agendamentos] = await Promise.all([
    db
      .from('business_hours')
      .select('professional_id, weekday, opens_at, closes_at')
      .eq('tenant_id', tenantId)
      .or(`professional_id.eq.${professionalId},professional_id.is.null`),
    db
      .from('time_off')
      .select('professional_id, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .or(`professional_id.eq.${professionalId},professional_id.is.null`)
      .lt('starts_at', fimJanela)
      .gt('ends_at', inicioJanela),
    db
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .eq('professional_id', professionalId)
      .in('status', ['pending', 'confirmed', 'arrived'])
      .lt('starts_at', fimJanela)
      .gt('ends_at', inicioJanela),
  ])
  if (horarios.error) throw new AppError('INTERNAL', { cause: horarios.error })
  if (folgas.error) throw new AppError('INTERNAL', { cause: folgas.error })
  if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })

  const timeOff: IntervaloOcupado[] = (folgas.data ?? []).map((f) => ({ start: f.starts_at, end: f.ends_at }))
  const ocupados: IntervaloOcupado[] = (agendamentos.data ?? []).map((a) => ({ start: a.starts_at, end: a.ends_at }))

  const todos: string[] = []
  for (let i = 0; i < numeroDeDias; i++) {
    const dia = primeiroDia.add({ days: i })
    const weekday = weekdayPg(dia)

    // Expediente específico do profissional para o dia; se ele não tem
    // nenhuma linha ali, cai no padrão do tenant (professional_id nulo) —
    // é o que o comentário da 0001 em business_hours descreve.
    const doProfissional = (horarios.data ?? []).filter((h) => h.professional_id === professionalId && h.weekday === weekday)
    const doPadrao = (horarios.data ?? []).filter((h) => h.professional_id === null && h.weekday === weekday)
    const businessHours: IntervaloExpediente[] = (doProfissional.length > 0 ? doProfissional : doPadrao).map((h) => ({
      opensAt: h.opens_at,
      closesAt: h.closes_at,
    }))
    if (businessHours.length === 0) continue

    todos.push(
      ...availableSlots({
        date: dia.toString(),
        timezone,
        businessHours,
        timeOff,
        appointments: ocupados,
        serviceDurationMin: servico.duration_min,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        slotGranularityMin: config.slotGranularityMin,
        minLeadTimeMinutes: config.minLeadTimeMinutes,
        maxAdvanceDays: config.maxAdvanceDays,
        now,
        parallelCapacity: servico.parallel_capacity,
      }),
    )
  }
  return todos
}

/** E71: os 3 horários livres mais próximos do que a pessoa pediu, mesmo profissional, em até 7 dias. */
async function alternativasProximas(
  db: Cliente,
  tenantId: string,
  professionalId: string,
  timezone: string,
  servico: ServicoAgendavel,
  startsAtPedido: string,
  now: string,
  config: { minLeadTimeMinutes: number; maxAdvanceDays: number; slotGranularityMin: number },
): Promise<string[]> {
  const diaPedido = Temporal.Instant.from(startsAtPedido).toZonedDateTimeISO(timezone).toPlainDate()
  const candidatos = await slotsDaJanela(db, tenantId, professionalId, timezone, servico, diaPedido, 7, now, config)

  const alvo = Temporal.Instant.from(startsAtPedido)
  return candidatos
    .map((s) => ({ s, distancia: Math.abs(Number(Temporal.Instant.from(s).since(alvo).total('seconds'))) }))
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 3)
    .map((c) => c.s)
}

/**
 * TICKET-021. A corrida entre dois pedidos pelo mesmo horário é resolvida
 * pelo banco (`appointments_no_overlap`, E59) — nunca por lock aqui. O que
 * este código faz é só: tentar o insert e, se a constraint recusar (Postgres
 * `23P01`), calcular as alternativas e devolver `SLOT_TAKEN`.
 */
export async function criarAgendamento(
  db: Cliente,
  tenantId: string,
  timezone: string,
  createdBy: string,
  entrada: EntradaCriar,
  settingsDoTenant: unknown,
) {
  const [servico] = await Promise.all([servicoDoTenant(db, tenantId, entrada.serviceId), profissionalDoTenant(db, tenantId, entrada.professionalId)])
  const clientId = await resolverCliente(db, tenantId, entrada)

  const startsAt = Temporal.Instant.from(entrada.startsAt)
  const endsAt = startsAt.add({ minutes: servico.duration_min })
  const config = lerConfiguracoesAgenda(settingsDoTenant)

  const { data, error } = await db
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: entrada.professionalId,
      service_id: entrada.serviceId,
      starts_at: startsAt.toString(),
      ends_at: endsAt.toString(),
      origin: entrada.origin,
      price_cents: servico.price_cents,
      client_note: entrada.note ?? null,
      created_by: createdBy,
    })
    .select(COLUNAS)
    .single()

  if (!error) return data

  // 23P01 = exclusion_violation — é exatamente o que `appointments_no_overlap` dispara.
  if (error.code !== '23P01') throw new AppError('INTERNAL', { cause: error })

  const alternatives = await alternativasProximas(
    db,
    tenantId,
    entrada.professionalId,
    timezone,
    servico,
    entrada.startsAt,
    Temporal.Now.instant().toString(),
    config,
  )
  throw new AppError('SLOT_TAKEN', { details: { alternatives } })
}

const ESTADOS_VALIDOS = new Set<EstadoAgendamento>(['pending', 'confirmed', 'arrived', 'done', 'no_show', 'canceled', 'expired'])

export async function listarAgendamentos(
  db: Cliente,
  tenantId: string,
  filtros: { from?: string; to?: string; professionalId?: string; status?: string },
) {
  let consulta = db.from('appointments').select(COLUNAS).eq('tenant_id', tenantId)
  if (filtros.from) consulta = consulta.gte('starts_at', filtros.from)
  if (filtros.to) consulta = consulta.lte('starts_at', filtros.to)
  if (filtros.professionalId) consulta = consulta.eq('professional_id', filtros.professionalId)
  // Valor de query string fora do enum é ignorado, não vira 500 — a pessoa só
  // não filtra por nada, o que é inofensivo.
  if (filtros.status && ESTADOS_VALIDOS.has(filtros.status as EstadoAgendamento)) {
    consulta = consulta.eq('status', filtros.status as EstadoAgendamento)
  }

  const { data, error } = await consulta.order('starts_at')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

async function buscarAgendamento(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db.from('appointments').select(COLUNAS).eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })
  return data
}

function exigirTransicao(atual: string, novo: EstadoAgendamento) {
  if (!transicaoValida(atual as EstadoAgendamento, novo)) {
    throw new AppError('INVALID_TRANSITION', {
      message: `Esse agendamento não pode ir de "${atual}" para "${novo}".`,
    })
  }
}

/** Remarcar revalida disponibilidade de novo — a exclusion constraint garante que o novo horário também não colide. */
export async function remarcarAgendamento(
  db: Cliente,
  tenantId: string,
  timezone: string,
  id: string,
  entrada: z.infer<typeof EsquemaRemarcar>,
  settingsDoTenant: unknown,
) {
  const atual = await buscarAgendamento(db, tenantId, id)

  // Remarcar não muda `status` (continua pending/confirmed), então não é uma
  // transição de `transicaoValida()` — a regra aqui é outra: só cabe remarcar
  // antes de a cliente chegar.
  if (!['pending', 'confirmed'].includes(atual.status)) {
    throw new AppError('INVALID_TRANSITION', { message: 'Só dá para remarcar um agendamento pendente ou confirmado.' })
  }

  const professionalId = entrada.professionalId ?? atual.professional_id
  if (entrada.professionalId) await profissionalDoTenant(db, tenantId, professionalId)

  const servico = await servicoDoTenant(db, tenantId, atual.service_id)
  const novoInicio = entrada.startsAt ? Temporal.Instant.from(entrada.startsAt) : Temporal.Instant.from(atual.starts_at)
  const novoFim = novoInicio.add({ minutes: servico.duration_min })

  const { data, error } = await db
    .from('appointments')
    .update({
      professional_id: professionalId,
      starts_at: novoInicio.toString(),
      ends_at: novoFim.toString(),
      client_note: entrada.note ?? atual.client_note,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(COLUNAS)
    .single()

  if (!error) return data
  if (error.code !== '23P01') throw new AppError('INTERNAL', { cause: error })

  const config = lerConfiguracoesAgenda(settingsDoTenant)
  const alternatives = await alternativasProximas(
    db,
    tenantId,
    professionalId,
    timezone,
    servico,
    novoInicio.toString(),
    Temporal.Now.instant().toString(),
    config,
  )
  throw new AppError('SLOT_TAKEN', { details: { alternatives } })
}

/** DELETE da API é semântico (regra 11: nunca apaga linha de agendamento) — sempre um UPDATE de status. */
export async function cancelarAgendamento(db: Cliente, tenantId: string, id: string, entrada: z.infer<typeof EsquemaCancelar>) {
  const atual = await buscarAgendamento(db, tenantId, id)
  exigirTransicao(atual.status as EstadoAgendamento, 'canceled')

  const { data, error } = await db
    .from('appointments')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      canceled_by: entrada.canceledBy,
      cancel_reason: entrada.reason ?? null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(COLUNAS)
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

async function transicaoSimples(
  db: Cliente,
  tenantId: string,
  id: string,
  novoEstado: EstadoAgendamento,
  camposExtra: Record<string, unknown> = {},
) {
  const atual = await buscarAgendamento(db, tenantId, id)
  exigirTransicao(atual.status as EstadoAgendamento, novoEstado)

  const { data, error } = await db
    .from('appointments')
    .update({ status: novoEstado, ...camposExtra })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(COLUNAS)
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export const confirmarAgendamento = (db: Cliente, tenantId: string, id: string) =>
  transicaoSimples(db, tenantId, id, 'confirmed', { confirmed_at: new Date().toISOString() })

export const marcarChegada = (db: Cliente, tenantId: string, id: string) =>
  transicaoSimples(db, tenantId, id, 'arrived', { arrived_at: new Date().toISOString() })

export const marcarFalta = (db: Cliente, tenantId: string, id: string) => transicaoSimples(db, tenantId, id, 'no_show')

/**
 * `POST .../complete` → 'done' **e** cria/retorna a comanda (TICKET-024,
 * `02-API §2.5`). A comanda nasce vazia (sem itens ainda) — populá-la é
 * trabalho do módulo de comanda, que ainda não existe; aqui só garante que
 * concluir sempre tem uma comanda do outro lado, criando-a se for a primeira
 * vez (idempotente por `appointment_id`, que não tem índice único ainda —
 * por isso a busca antes do insert).
 */
export async function concluirAgendamento(db: Cliente, tenantId: string, id: string) {
  const agendamento = await transicaoSimples(db, tenantId, id, 'done', { completed_at: new Date().toISOString() })

  const { data: existente, error: erroExistente } = await db
    .from('tickets')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('appointment_id', id)
    .maybeSingle()
  if (erroExistente) throw new AppError('INTERNAL', { cause: erroExistente })
  if (existente) return { appointment: agendamento, ticket: existente }

  const { data: ticket, error: erroTicket } = await db
    .from('tickets')
    .insert({
      tenant_id: tenantId,
      client_id: agendamento.client_id,
      appointment_id: id,
      professional_id: agendamento.professional_id,
    })
    .select('id, status')
    .single()
  if (erroTicket) throw new AppError('INTERNAL', { cause: erroTicket })

  return { appointment: agendamento, ticket }
}
