import { ouDoProfissionalOuGeral } from '@/server/db/filtro'
import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { descreverRegra } from '@/core/recurrence/descrever'
import { ocorrenciaConflitaComFolga, proximasDatas, type LimiteSerie, type RegraRecorrencia } from '@/core/recurrence/gerar-ocorrencias'
import { resolverCliente } from '@/server/services/agendamentos'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Horizonte de geração por rodada (docs/09-PLATAFORMA.md §12). Estender a série além disso
 * exige rodar `gerarOcorrenciasPendentes` de novo (cron ainda não existe — pendência
 * registrada em §19, não é esquecimento: a série cadastrada e as primeiras ocorrências já
 * resolvem o caso de uso principal sem depender de infraestrutura de fila nova).
 */
const HORIZONTE_DIAS = 90
const TETO_OCORRENCIAS_POR_RODADA = 26

export const EsquemaCriarSerie = z
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
    tipo: z.enum(['semanal', 'a_cada_dias', 'mensal_dia_semana']),
    weekday: z.number().int().min(0).max(6).nullish(),
    intervaloSemanas: z.number().int().min(1).max(52).nullish(),
    intervaloDias: z.number().int().min(1).max(365).nullish(),
    ordinalNoMes: z.number().int().min(1).max(5).nullish(),
    horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido.'),
    startsOn: z.iso.date('Data inválida.'),
    endsOn: z.iso.date('Data inválida.').nullish(),
    maxOcorrencias: z.number().int().min(1).max(200).nullish(),
    note: z.string().trim().max(500).nullish(),
    address: z.string().trim().max(300).nullish(),
  })
  .refine((d) => d.tipo !== 'semanal' || (d.weekday != null && d.intervaloSemanas != null), {
    message: 'Informe o dia da semana e o intervalo.',
    path: ['weekday'],
  })
  .refine((d) => d.tipo !== 'a_cada_dias' || d.intervaloDias != null, {
    message: 'Informe o intervalo em dias.',
    path: ['intervaloDias'],
  })
  .refine((d) => d.tipo !== 'mensal_dia_semana' || (d.weekday != null && d.ordinalNoMes != null), {
    message: 'Informe o dia da semana e a ordem no mês.',
    path: ['weekday'],
  })
  .refine((d) => !(d.endsOn && d.maxOcorrencias), {
    message: 'Escolha um jeito de terminar a série: por data OU por número de vezes, não os dois.',
    path: ['endsOn'],
  })
  .refine((d) => d.clientId ?? d.clientDraft, {
    message: 'Informe o cliente já cadastrado ou os dados dele.',
    path: ['clientId'],
  })

type EntradaCriarSerie = z.infer<typeof EsquemaCriarSerie>

function regraDaEntrada(e: EntradaCriarSerie): RegraRecorrencia {
  if (e.tipo === 'semanal') return { tipo: 'semanal', weekday: e.weekday!, intervaloSemanas: e.intervaloSemanas! }
  if (e.tipo === 'a_cada_dias') return { tipo: 'a_cada_dias', intervaloDias: e.intervaloDias! }
  return { tipo: 'mensal_dia_semana', weekday: e.weekday!, ordinal: e.ordinalNoMes! }
}

type ServicoAgendavel = { duration_min: number; price_cents: number }

async function servicoDoTenant(db: Cliente, tenantId: string, serviceId: string): Promise<ServicoAgendavel> {
  const { data, error } = await db
    .from('services')
    .select('duration_min, price_cents')
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

type ResultadoOcorrencia = { data: string; status: 'agendada' | 'pulada_folga' | 'pulada_conflito' }

/**
 * Planta as ocorrências de uma série já existente dentro do horizonte de geração, pulando
 * (não deslocando — decisão registrada em docs/DECISOES.md, §12 permite qualquer uma das
 * duas) datas em folga do profissional/tenant ou que colidam com outro agendamento. Cada
 * ocorrência plantada é um `appointments` normal com `recurrence_id` apontando pra série —
 * editar ou cancelar uma ocorrência nunca toca a série (são linhas independentes).
 */
async function plantarOcorrencias(
  db: Cliente,
  tenantId: string,
  timezone: string,
  createdBy: string | null,
  serie: {
    id: string
    professional_id: string
    service_id: string
    client_id: string
    tipo: string
    weekday: number | null
    intervalo_semanas: number | null
    intervalo_dias: number | null
    ordinal_no_mes: number | null
    horario: string
    starts_on: string
    ends_on: string | null
    max_ocorrencias: number | null
    ocorrencias_geradas: number
    note: string | null
    address: string | null
  },
  servico: ServicoAgendavel,
  aPartirDe: string, // YYYY-MM-DD — permite estender uma série já plantada sem replantar o passado
): Promise<ResultadoOcorrencia[]> {
  const regra = regraDaEntrada({
    tipo: serie.tipo as EntradaCriarSerie['tipo'],
    weekday: serie.weekday,
    intervaloSemanas: serie.intervalo_semanas,
    intervaloDias: serie.intervalo_dias,
    ordinalNoMes: serie.ordinal_no_mes,
  } as EntradaCriarSerie)
  const limite: LimiteSerie = serie.ends_on
    ? { tipo: 'ate_data', data: serie.ends_on }
    : serie.max_ocorrencias
      ? { tipo: 'numero_de_vezes', total: serie.max_ocorrencias }
      : { tipo: 'sem_fim' }

  const horizonte = Temporal.Now.plainDateISO(timezone).add({ days: HORIZONTE_DIAS }).toString()
  const datas = proximasDatas({
    regra,
    inicio: aPartirDe,
    limite,
    ocorrenciasJaGeradas: serie.ocorrencias_geradas,
    horizonte,
    tetoDeSeguranca: TETO_OCORRENCIAS_POR_RODADA,
  })
  if (datas.length === 0) return []

  const [hh, mm] = serie.horario.split(':').map(Number)
  const primeiraData = Temporal.PlainDate.from(datas[0]!)
  const ultimaData = Temporal.PlainDate.from(datas[datas.length - 1]!)
  const inicioJanela = primeiraData.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fimJanela = ultimaData.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const [folgas, ocupados] = await Promise.all([
    db
      .from('time_off')
      .select('professional_id, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .or(ouDoProfissionalOuGeral('professional_id', serie.professional_id))
      .lt('starts_at', fimJanela)
      .gt('ends_at', inicioJanela),
    db
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .eq('professional_id', serie.professional_id)
      .in('status', ['pending', 'confirmed', 'arrived'])
      .lt('starts_at', fimJanela)
      .gt('ends_at', inicioJanela),
  ])
  if (folgas.error) throw new AppError('INTERNAL', { cause: folgas.error })
  if (ocupados.error) throw new AppError('INTERNAL', { cause: ocupados.error })

  const blocosFolga = (folgas.data ?? []).map((f) => ({ start: f.starts_at, end: f.ends_at }))
  const blocosOcupados = (ocupados.data ?? []).map((a) => ({ start: a.starts_at, end: a.ends_at }))

  const resultados: ResultadoOcorrencia[] = []
  let novasGeradas = 0

  for (const data of datas) {
    const dia = Temporal.PlainDate.from(data)
    const startsAt = dia.toZonedDateTime({ timeZone: timezone, plainTime: { hour: hh, minute: mm } }).toInstant()
    const endsAt = startsAt.add({ minutes: servico.duration_min })

    if (ocorrenciaConflitaComFolga(startsAt.toString(), endsAt.toString(), blocosFolga)) {
      resultados.push({ data, status: 'pulada_folga' })
      continue
    }
    if (ocorrenciaConflitaComFolga(startsAt.toString(), endsAt.toString(), blocosOcupados)) {
      resultados.push({ data, status: 'pulada_conflito' })
      continue
    }

    const { error } = await db.from('appointments').insert({
      tenant_id: tenantId,
      client_id: serie.client_id,
      professional_id: serie.professional_id,
      service_id: serie.service_id,
      starts_at: startsAt.toString(),
      ends_at: endsAt.toString(),
      origin: 'recurring',
      price_cents: servico.price_cents,
      client_note: serie.note ?? null,
      address: serie.address ?? null,
      created_by: createdBy,
      recurrence_id: serie.id,
    })
    // Corrida contra um agendamento avulso criado entre a checagem acima e este insert:
    // o banco resolve (mesma constraint appointments_no_overlap) — nesse caso a ocorrência
    // simplesmente é pulada por conflito, sem derrubar o resto da série.
    if (error && error.code !== '23P01') throw new AppError('INTERNAL', { cause: error })
    resultados.push({ data, status: error ? 'pulada_conflito' : 'agendada' })
    if (!error) novasGeradas++
  }

  if (novasGeradas > 0) {
    const { error } = await db
      .from('appointment_series')
      .update({ ocorrencias_geradas: serie.ocorrencias_geradas + novasGeradas })
      .eq('id', serie.id)
      .eq('tenant_id', tenantId)
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return resultados
}

/** Cria a série e planta a primeira leva de ocorrências dentro do horizonte de geração. */
export async function criarSerie(db: Cliente, tenantId: string, timezone: string, createdBy: string | null, entrada: EntradaCriarSerie) {
  const [clientId] = await Promise.all([resolverCliente(db, tenantId, entrada), profissionalDoTenant(db, tenantId, entrada.professionalId)])
  const servico = await servicoDoTenant(db, tenantId, entrada.serviceId)

  const { data: serie, error } = await db
    .from('appointment_series')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: entrada.professionalId,
      service_id: entrada.serviceId,
      tipo: entrada.tipo,
      weekday: entrada.weekday ?? null,
      intervalo_semanas: entrada.intervaloSemanas ?? null,
      intervalo_dias: entrada.intervaloDias ?? null,
      ordinal_no_mes: entrada.ordinalNoMes ?? null,
      horario: entrada.horario,
      starts_on: entrada.startsOn,
      ends_on: entrada.endsOn ?? null,
      max_ocorrencias: entrada.maxOcorrencias ?? null,
      note: entrada.note ?? null,
      address: entrada.address ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single()
  if (error) throw new AppError('INTERNAL', { cause: error })

  const ocorrencias = await plantarOcorrencias(db, tenantId, timezone, createdBy, serie, servico, entrada.startsOn)
  return { serie, ocorrencias }
}

async function buscarSerie(db: Cliente, tenantId: string, id: string) {
  const { data, error } = await db.from('appointment_series').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa série não existe mais.' })
  return data
}

/**
 * Cancela a série (não apaga — regra 11) e cancela as ocorrências futuras ainda pendentes ou
 * confirmadas. Ocorrências passadas (done/no_show/já canceladas) ficam intactas — cancelar o
 * contrato não reescreve o histórico do que já aconteceu.
 */
export async function cancelarSerie(db: Cliente, tenantId: string, id: string) {
  const serie = await buscarSerie(db, tenantId, id)
  if (serie.status === 'canceled') throw new AppError('INVALID_TRANSITION', { message: 'Essa série já está cancelada.' })

  const { error: erroSerie } = await db
    .from('appointment_series')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (erroSerie) throw new AppError('INTERNAL', { cause: erroSerie })

  const { data: futuras, error: erroBusca } = await db
    .from('appointments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('recurrence_id', id)
    .in('status', ['pending', 'confirmed'])
  if (erroBusca) throw new AppError('INTERNAL', { cause: erroBusca })

  if (futuras && futuras.length > 0) {
    const { error: erroCancelar } = await db
      .from('appointments')
      .update({ status: 'canceled', canceled_at: new Date().toISOString(), canceled_by: 'professional', cancel_reason: 'Série de recorrência cancelada' })
      .in(
        'id',
        futuras.map((f) => f.id),
      )
      .eq('tenant_id', tenantId)
    if (erroCancelar) throw new AppError('INTERNAL', { cause: erroCancelar })
  }

  return { serieCancelada: id, ocorrenciasCanceladas: futuras?.length ?? 0 }
}

export type SerieDaLista = {
  id: string
  status: string
  descricao: string
  clientName: string
  serviceName: string
  professionalName: string
  ocorrenciasGeradas: number
  maxOcorrencias: number | null
  createdAt: string
}

type LinhaSerie = {
  // `text` com `check` no banco — o gerador de tipos não estreita pra união literal.
  tipo: string
  weekday: number | null
  intervalo_semanas: number | null
  intervalo_dias: number | null
  ordinal_no_mes: number | null
}

/** Mesmo formato de `regraDaEntrada`, só que a partir da linha já gravada (colunas do banco). */
function regraDaLinha(l: LinhaSerie): RegraRecorrencia {
  if (l.tipo === 'semanal') return { tipo: 'semanal', weekday: l.weekday!, intervaloSemanas: l.intervalo_semanas! }
  if (l.tipo === 'a_cada_dias') return { tipo: 'a_cada_dias', intervaloDias: l.intervalo_dias! }
  if (l.tipo === 'mensal_dia_semana') return { tipo: 'mensal_dia_semana', weekday: l.weekday!, ordinal: l.ordinal_no_mes! }
  throw new AppError('INTERNAL', { cause: new Error(`appointment_series.tipo desconhecido: ${l.tipo}`) })
}

/**
 * P7 (TICKET-067) construiu criar série e cancelar (API), mas não uma lista — hoje só dava
 * pra ver séries ativas via SQL direto. Ativas primeiro (é o que o dono precisa agir em cima),
 * canceladas depois, as duas por `created_at` desc dentro do próprio grupo.
 */
export async function listarSeries(db: Cliente, tenantId: string): Promise<SerieDaLista[]> {
  const { data, error } = await db
    .from('appointment_series')
    .select(
      'id, status, tipo, weekday, intervalo_semanas, intervalo_dias, ordinal_no_mes, ocorrencias_geradas, max_ocorrencias, created_at, clients ( name ), services ( name ), professionals ( display_name )',
    )
    .eq('tenant_id', tenantId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw new AppError('INTERNAL', { cause: error })

  return (data ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    descricao: descreverRegra(regraDaLinha(s)),
    clientName: (s.clients as unknown as { name: string } | null)?.name ?? 'Cliente removido',
    serviceName: (s.services as unknown as { name: string } | null)?.name ?? 'Serviço removido',
    professionalName: (s.professionals as unknown as { display_name: string } | null)?.display_name ?? 'Profissional removido',
    ocorrenciasGeradas: s.ocorrencias_geradas,
    maxOcorrencias: s.max_ocorrencias,
    createdAt: s.created_at,
  }))
}
