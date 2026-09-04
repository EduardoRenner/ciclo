import { aindaContaComoReceita } from '@/core/agenda/ainda-conta-como-receita'
import { ouDoProfissionalOuGeral } from '@/server/db/filtro'
import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { availableSlots, type IntervaloExpediente, type IntervaloOcupado } from '@/core/scheduling/available-slots'
import { transicaoValida, type EstadoAgendamento } from '@/core/scheduling/state'
import { recomputarCicloDeUmAtendimento } from '@/server/services/ciclo'
import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'
import { pontuarAtendimentoConcluido } from '@/server/services/fidelidade'
import { calcularScoreDeRisco } from '@/server/services/risco'
import { hashTelefone, normalizarTelefoneBR } from '@/server/services/telefone'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const COLUNAS =
  'id, tenant_id, client_id, professional_id, service_id, starts_at, ends_at, status, origin, price_cents, confirmed_at, arrived_at, completed_at, canceled_at, canceled_by, cancel_reason, client_note, address, no_show_score'

export const EsquemaCriarAgendamento = z
  .object({
    clientId: z.uuid().nullish(),
    clientDraft: z
      .object({
        name: z.string().trim().min(2, 'Digite o nome do cliente.'),
        phone: z.string().trim().min(1, 'Digite o telefone do cliente.'),
      })
      .nullish(),
    serviceId: z.uuid('Escolha um serviço.'),
    professionalId: z.uuid('Escolha um profissional.'),
    startsAt: z.iso.datetime({ message: 'Horário inválido.', offset: true }),
    origin: z.enum(['app', 'public_page', 'whatsapp', 'recurring', 'waitlist', 'import']).default('app'),
    note: z.string().trim().max(500, 'Nota muito longa.').nullish(),
    // docs/09-PLATAFORMA.md G3+G13 (P2.5): opcional pra todo mundo — mesmo
    // salão fixo às vezes atende em domicílio. Nunca geocodificado (§10).
    address: z.string().trim().max(300, 'Endereço muito longo.').nullish(),
  })
  .refine((d) => d.clientId ?? d.clientDraft, {
    message: 'Informe o cliente já cadastrado ou os dados dele.',
    path: ['clientId'],
  })

export const EsquemaRemarcar = z.object({
  startsAt: z.iso.datetime({ message: 'Horário inválido.', offset: true }).nullish(),
  professionalId: z.uuid().nullish(),
  note: z.string().trim().max(500).nullish(),
})

export const EsquemaCancelar = z.object({
  reason: z.string().trim().max(500).nullish(),
  canceledBy: z.enum(['client', 'professional', 'system']),
})

type EntradaCriar = z.infer<typeof EsquemaCriarAgendamento>

/**
 * Resolve `clientId` ou cria a partir de `clientDraft`, reaproveitando cliente existente pelo
 * telefone.
 *
 * `referredBy` é o I-1 do `docs/30-INDICACAO-PLANO.md`: `clients.referred_by` existe desde a
 * migration 0001, `pontuarAtendimentoConcluido` já credita os dois lados na primeira visita
 * concluída — e, até esta rodada, nada no produto escrevia a coluna. O único lugar que a
 * escrevia era `scripts/seed-demo-barbearia.mjs`, então o recurso funcionava na demonstração e
 * em tenant nenhum de verdade.
 *
 * Só entra no ramo de CRIAÇÃO — indicação é para trazer gente nova. Quem já é cliente ignora o
 * convite em silêncio (o token não é reaproveitável de qualquer forma: a página de agendamento
 * não teria como saber se a pessoa "já era cliente" antes de o telefone chegar, e forçar
 * `referred_by` sobre um cadastro existente reescreveria a origem de alguém que o salão talvez já
 * tenha conquistado sozinho).
 */
export async function resolverCliente(
  db: Cliente,
  tenantId: string,
  entrada: { clientId?: string | null; clientDraft?: { name: string; phone: string } | null },
  referredBy?: string | null,
): Promise<string> {
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

  /*
   * O token de indicação já prova que ALGUÉM assinou aquele `client_id` — mas não prova que ele
   * ainda existe NESTE tenant, nem que não foi eliminado (LGPD art. 18 VI) depois de assinado.
   * Um token velho ou forjado não pode quebrar o agendamento: em vez de erro, a referência
   * simplesmente não entra, e a cliente nasce como qualquer outra.
   */
  let referenciaValida: string | null = null
  if (referredBy) {
    const { data: referenciador } = await db
      .from('clients')
      .select('id')
      .eq('id', referredBy)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()
    referenciaValida = referenciador?.id ?? null
  }

  const { data: criado, error: erroCriar } = await db
    .from('clients')
    .insert({ tenant_id: tenantId, name: draft.name, phone_e164: e164, phone_hash: hash, source: 'agenda', referred_by: referenciaValida })
    .select('id')
    .single()
  if (erroCriar) throw new AppError('INTERNAL', { cause: erroCriar })
  return criado.id
}

type ServicoAgendavel = {
  duration_min: number
  price_cents: number
  parallel_capacity: number
  buffer_before_min: number
  buffer_after_min: number
}

async function servicoDoTenant(db: Cliente, tenantId: string, serviceId: string): Promise<ServicoAgendavel> {
  const { data, error } = await db
    .from('services')
    .select('duration_min, price_cents, parallel_capacity, buffer_before_min, buffer_after_min')
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
      .or(ouDoProfissionalOuGeral('professional_id', professionalId)),
    db
      .from('time_off')
      .select('professional_id, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .or(ouDoProfissionalOuGeral('professional_id', professionalId))
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
        // Achado ao trabalhar em P9 (§10): a sugestão de alternativas do 409 (E71) nunca lia o
        // buffer do serviço — só o booking público (public-booking.ts) fazia isso. Uma
        // profissional que configura "15min de preparo antes" via painel via essa regra
        // funcionar pra cliente que agenda sozinha, mas não pra ela mesma marcando manualmente.
        bufferBeforeMin: servico.buffer_before_min,
        bufferAfterMin: servico.buffer_after_min,
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
  // null no booking público (origin: 'public_page'): não existe profile
  // autenticado por trás para satisfazer a FK de created_by, e a coluna é
  // nullable exatamente para esse caso.
  createdBy: string | null,
  entrada: EntradaCriar,
  settingsDoTenant: unknown,
  // I-1 (`docs/30-INDICACAO-PLANO.md`): `client_id` de quem indicou, resolvido do token `?ind=`
  // pela própria rota de booking público. Omitido em toda chamada interna (`app`) — a indicação
  // só nasce de um link compartilhado, nunca do cadastro manual.
  referredBy?: string | null,
) {
  const [servico] = await Promise.all([servicoDoTenant(db, tenantId, entrada.serviceId), profissionalDoTenant(db, tenantId, entrada.professionalId)])
  const clientId = await resolverCliente(db, tenantId, entrada, referredBy)

  const startsAt = Temporal.Instant.from(entrada.startsAt)
  const endsAt = startsAt.add({ minutes: servico.duration_min })
  const config = lerConfiguracoesAgenda(settingsDoTenant)

  // §5.4: calculado na criação, não depois — é o que o booking público
  // (TICKET-041) vai usar para decidir se exige sinal. Uma falha aqui não
  // pode impedir o agendamento de nascer; sem score, a agenda só não mostra
  // o alerta ⚡, o que é bem menos grave que travar a marcação inteira.
  const risco = await calcularScoreDeRisco(db, tenantId, timezone, { clientId, startsAt: startsAt.toString() }).catch((erro: unknown) => {
    console.error(JSON.stringify({ level: 'error', event: 'calculo_risco_falhou', tenantId, clientId }), erro)
    return null
  })

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
      address: entrada.address ?? null,
      created_by: createdBy,
      no_show_score: risco?.score ?? null,
      risk_features: risco?.features ?? null,
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

const COLUNAS_AGENDA_DIA =
  'id, starts_at, ends_at, status, price_cents, client_note, address, professional_id, no_show_score, clients ( name ), services ( name ), professionals ( display_name )'

export type LinhaAgendaDia = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  price_cents: number
  client_note: string | null
  /** docs/09-PLATAFORMA.md G3+G13 (P2.5) — endereço do atendimento, não do cliente. */
  address: string | null
  professional_id: string
  /** §5.4. `null` até o cálculo rodar (agendamento antigo, ou o cálculo falhou na criação). */
  no_show_score: number | null
  clients: { name: string } | null
  services: { name: string } | null
  professionals: { display_name: string } | null
}

export type ResumoAgendaDia = {
  appointments: LinhaAgendaDia[]
  /** 0 a 1 — minutos ocupados / minutos de expediente do dia. Sem expediente cadastrado, é 0. */
  occupancyRate: number
  /**
   * 2026-08-30, achado medindo a tela ao vivo: sem isto, um dia sem `business_hours` cadastrado
   * (ex.: domingo fechado) mostra "0% de ocupação" mesmo com agendamentos reais marcados — o
   * número está matematicamente certo (0 minutos de expediente para dividir) mas lido como
   * "dia vazio", que é falso. Quem mostra `occupancyRate` tem que checar isto primeiro e trocar
   * o texto por "sem expediente cadastrado" em vez de "0%" — mesma classe do achado docs/29 A3
   * ("Taxa" sempre R$ 0,00: número certo, leitura errada).
   */
  temExpediente: boolean
  /** Soma do `price_cents` dos agendamentos que ainda valem (não cancelados/vencidos/faltosos). */
  forecastCents: number
}

const CONTAM_COMO_RECEITA: EstadoAgendamento[] = ['pending', 'confirmed', 'arrived', 'done']

/**
 * TICKET-022: os dados prontos para a timeline vertical de um dia — já com o
 * nome de cliente/serviço/profissional via join (uma consulta só; 60
 * agendamentos não viram 60 idas ao banco) e os dois números do cabeçalho
 * (ocupação, previsto).
 */
export async function listarAgendaDoDia(
  db: Cliente,
  tenantId: string,
  date: string,
  timezone: string,
  professionalId?: string,
): Promise<ResumoAgendaDia> {
  const dia = Temporal.PlainDate.from(date)
  const inicio = dia.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()
  const fim = dia.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()

  let consulta = db
    .from('appointments')
    .select(COLUNAS_AGENDA_DIA)
    .eq('tenant_id', tenantId)
    .gte('starts_at', inicio.toString())
    .lt('starts_at', fim.toString())
  if (professionalId) consulta = consulta.eq('professional_id', professionalId)

  const [{ data: appointments, error: erroAg }, horariosDoDia] = await Promise.all([
    consulta.order('starts_at'),
    professionalId
      ? db
          .from('business_hours')
          .select('professional_id, opens_at, closes_at')
          .eq('tenant_id', tenantId)
          .eq('weekday', weekdayPg(dia))
          .or(ouDoProfissionalOuGeral('professional_id', professionalId))
      : db.from('business_hours').select('professional_id, opens_at, closes_at').eq('tenant_id', tenantId).eq('weekday', weekdayPg(dia)).is('professional_id', null),
  ])
  if (erroAg) throw new AppError('INTERNAL', { cause: erroAg })
  if (horariosDoDia.error) throw new AppError('INTERNAL', { cause: horariosDoDia.error })

  const linhas = (appointments ?? []) as unknown as LinhaAgendaDia[]

  // Se o profissional tem expediente próprio para o dia, usa o dele; senão o padrão do tenant.
  const doProfissional = professionalId ? horariosDoDia.data.filter((h) => h.professional_id === professionalId) : []
  const janelas = doProfissional.length > 0 ? doProfissional : horariosDoDia.data.filter((h) => h.professional_id === null)

  const minutosDeExpediente = janelas.reduce((soma, j) => {
    const abre = Temporal.PlainTime.from(j.opens_at)
    const fecha = Temporal.PlainTime.from(j.closes_at)
    return soma + abre.until(fecha).total('minutes')
  }, 0)

  const minutosOcupados = linhas
    .filter((a) => CONTAM_COMO_RECEITA.includes(a.status as EstadoAgendamento))
    .reduce((soma, a) => soma + Temporal.Instant.from(a.starts_at).until(Temporal.Instant.from(a.ends_at)).total('minutes'), 0)

  /*
   * Ocupacao acima usa a lista crua de propósito: a cadeira ESTEVE ocupada por aquele pedido, e
   * mudar isso reescreveria o passado. Ja o previsto e dinheiro que ainda vai entrar — e um
   * `pending` cuja hora passou nao vai. Ver `core/agenda/ainda-conta-como-receita.ts`.
   */
  const agora = new Date()
  const forecastCents = linhas
    .filter((a) => aindaContaComoReceita({ status: a.status, endsAt: a.ends_at }, agora))
    .reduce((soma, a) => soma + a.price_cents, 0)

  return {
    appointments: linhas,
    occupancyRate: minutosDeExpediente > 0 ? Math.min(1, minutosOcupados / minutosDeExpediente) : 0,
    temExpediente: janelas.length > 0,
    forecastCents,
  }
}

export async function listarAgendamentos(
  db: Cliente,
  tenantId: string,
  filtros: { from?: string; to?: string; professionalId?: string; status?: string; clientId?: string },
) {
  let consulta = db.from('appointments').select(COLUNAS).eq('tenant_id', tenantId)
  if (filtros.from) consulta = consulta.gte('starts_at', filtros.from)
  if (filtros.to) consulta = consulta.lte('starts_at', filtros.to)
  if (filtros.professionalId) consulta = consulta.eq('professional_id', filtros.professionalId)
  // docs/26-AGENTE-IA-PLANO.md §3 — ferramenta `historico_do_cliente` do assistente reusa esta
  // função em vez de duplicar a consulta; único filtro que faltava aqui.
  if (filtros.clientId) consulta = consulta.eq('client_id', filtros.clientId)
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
    .eq('status', atual.status)
    .select(COLUNAS)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('INVALID_TRANSITION', { message: 'Esse agendamento mudou de estado enquanto você decidia. Recarregue a agenda.' })
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

  /*
   * `.eq('status', atual.status)` no próprio UPDATE. Sem isso a validação era ler-decidir-escrever
   * com uma ida ao banco no meio: dois toques simultâneos — "concluir" num aparelho e "faltou" no
   * outro, ou o mesmo botão duas vezes na rede ruim de um salão — passavam os dois pelo
   * `exigirTransicao` lendo `arrived`, e o último a escrever ganhava. Pior no `concluir`, que cria
   * a comanda depois: os dois criavam a sua, e o agendamento acabava `no_show` com faturamento
   * lançado. A máquina de estados só vale se a transição for atômica.
   */
  const { data, error } = await db
    .from('appointments')
    .update({ status: novoEstado, ...camposExtra })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', atual.status)
    .select(COLUNAS)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('INVALID_TRANSITION', { message: 'Esse agendamento mudou de estado enquanto você decidia. Recarregue a agenda.' })
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
 * vez. A unicidade é do banco desde a migration 0045
 * (`tickets_um_por_agendamento`): a busca antes do insert é o caminho comum, e o `23505` abaixo
 * é o que sobra quando duas escritas chegam juntas.
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

  // §5.3: "recalcula em tempo real quando um atendimento é concluído" — só a
  // combinação cliente+serviço deste agendamento, não o tenant inteiro. Uma
  // falha aqui não pode derrubar a conclusão, que já aconteceu; o job diário
  // (TICKET-036) é a rede de segurança se isto não rodar.
  if (agendamento.client_id) {
    const { data: tenantRow } = await db.from('tenants').select('timezone').eq('id', tenantId).maybeSingle()
    const fusoDoSalao = tenantRow?.timezone ?? 'America/Sao_Paulo'
    /*
     * O "hoje" saía de `new Date().toISOString()` — UTC — enquanto o histórico, dentro de
     * `recomputarCicloDeUmAtendimento`, é convertido para o fuso do salão. O `computeCycle`
     * comparava as duas coisas em fusos diferentes: em Brasília (UTC-3), das 21h à meia-noite,
     * "hoje" chegava um dia adiantado e o cliente saía com `late_days` inflado em 1 — podendo
     * virar de "em dia" para "atrasado" e aparecer cedo demais em "Recuperar receita".
     *
     * O caminho do cron (`api/cron/recompute-cycles`) já fazia certo, com o dia no fuso do
     * tenant. Dois escritores da mesma tabela `client_cycles` discordavam sobre que dia era
     * hoje, e o dado só se acertava às 3h da manhã, quando o job diário reescrevia — justamente
     * depois do horário em que o salão mais conclui atendimento. Isto aqui não decide regra
     * nova: faz o caminho errado seguir o que o certo já define.
     */
    await recomputarCicloDeUmAtendimento(
      db,
      tenantId,
      fusoDoSalao,
      { clientId: agendamento.client_id, serviceId: agendamento.service_id },
      Temporal.Now.instant().toZonedDateTimeISO(fusoDoSalao).toPlainDate().toString(),
    ).catch((erro: unknown) => {
      console.error(JSON.stringify({ level: 'error', event: 'recompute_ciclo_falhou', appointmentId: id }), erro)
    })

    // Fidelidade automática (não é mais "a profissional lembrar de lançar"): mesma regra do
    // recálculo de ciclo acima — bônus nunca pode derrubar a conclusão do atendimento.
    await pontuarAtendimentoConcluido(db, tenantId, {
      appointmentId: id,
      clientId: agendamento.client_id,
      priceCents: agendamento.price_cents,
    }).catch((erro: unknown) => {
      console.error(JSON.stringify({ level: 'error', event: 'pontuar_atendimento_falhou', appointmentId: id }), erro)
    })
  }

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
    .maybeSingle()

  // `23505` aqui só acontece se outra escrita criou a comanda deste agendamento entre a busca
  // acima e este insert. A comanda existe e é a certa — devolvê-la é o resultado correto, não um
  // erro. Mesmo desenho do `SLOT_TAKEN` em `criarAgendamento`: deixa a constraint decidir.
  if (erroTicket?.code === '23505') {
    const { data: existenteAgora, error: erroBusca } = await db
      .from('tickets')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('appointment_id', id)
      .maybeSingle()
    if (erroBusca) throw new AppError('INTERNAL', { cause: erroBusca })
    if (existenteAgora) return { appointment: agendamento, ticket: existenteAgora }
  }
  if (erroTicket) throw new AppError('INTERNAL', { cause: erroTicket })
  if (!ticket) throw new AppError('INTERNAL')

  return { appointment: agendamento, ticket }
}
