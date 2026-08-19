import { z } from 'zod'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type PreferenciasCliente = Record<string, string>

export type FichaCliente = {
  cliente: {
    id: string
    name: string
    phoneE164: string | null
    email: string | null
    birthDate: string | null
    notes: string | null
    tags: string[]
    source: string | null
    preferences: PreferenciasCliente
    marketingOptIn: boolean
    whatsappOptOut: boolean
    createdAt: string
  }
  metricas: {
    ltvCents: number
    visitas: number
    faltas: number
    ticketMedioCents: number
    ultimaVisita: string | null
  }
  ciclo: { state: string; lateDays: number; predictedOn: string | null; serviceName: string } | null
  historico: {
    id: string
    startsAt: string
    status: string
    priceCents: number
    serviceName: string
    professionalName: string
  }[]
  mensagens: { id: string; kind: string; channel: string; status: string; createdAt: string }[]
  indicadoPor: { id: string; name: string } | null
  indicados: { id: string; name: string }[]
}

/** `preferences` chega como `Json`; só interessa o objeto raso de texto que o formulário grava. */
function lerPreferencias(bruto: unknown): PreferenciasCliente {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {}
  const saida: PreferenciasCliente = {}
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof valor === 'string' && valor.trim() !== '') saida[chave] = valor
  }
  return saida
}

/**
 * Tudo que a tela da ficha mostra, numa função só. O histórico é o que dá contexto na hora do
 * atendimento ("quando ele veio da última vez e o que fez"), e é justamente o que a lista de
 * clientes nunca mostrou — até esta tela existir, esses dados estavam no banco sem porta de
 * entrada nenhuma.
 */
export async function fichaDoCliente(db: Cliente, tenantId: string, clientId: string): Promise<FichaCliente> {
  const { data: cliente, error } = await db
    .from('clients')
    .select(
      'id, name, phone_e164, email, birth_date, notes, tags, source, referred_by, preferences, marketing_opt_in, whatsapp_opt_out, visits_count, no_show_count, ltv_cents, last_visit_at, created_at',
    )
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!cliente) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })

  const [historicoBruto, ciclosBruto, mensagensBruto, indicadosBruto, padrinhoBruto] = await Promise.all([
    db
      .from('appointments')
      .select('id, starts_at, status, price_cents, services(name), professionals(display_name)')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('starts_at', { ascending: false })
      .limit(40),
    db
      .from('client_cycles')
      .select('state, late_days, predicted_on, services(name)')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('value_at_risk_cents', { ascending: false })
      .limit(1),
    db
      .from('messages')
      .select('id, kind, channel, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('clients').select('id, name').eq('tenant_id', tenantId).eq('referred_by', clientId).is('deleted_at', null),
    cliente.referred_by
      ? db.from('clients').select('id, name').eq('tenant_id', tenantId).eq('id', cliente.referred_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const historico = (historicoBruto.data ?? []).map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    status: a.status,
    priceCents: a.price_cents,
    serviceName: a.services?.name ?? 'Serviço removido',
    professionalName: a.professionals?.display_name ?? '—',
  }))

  const cicloBruto = ciclosBruto.data?.[0]
  const visitas = cliente.visits_count

  return {
    cliente: {
      id: cliente.id,
      name: cliente.name,
      phoneE164: cliente.phone_e164,
      email: cliente.email,
      birthDate: cliente.birth_date,
      notes: cliente.notes,
      tags: cliente.tags,
      source: cliente.source,
      preferences: lerPreferencias(cliente.preferences),
      marketingOptIn: cliente.marketing_opt_in,
      whatsappOptOut: cliente.whatsapp_opt_out,
      createdAt: cliente.created_at,
    },
    metricas: {
      ltvCents: cliente.ltv_cents,
      visitas,
      faltas: cliente.no_show_count,
      // Ticket médio sobre visitas concluídas — dividir por 0 na cliente que nunca veio daria NaN na tela.
      ticketMedioCents: visitas > 0 ? Math.round(cliente.ltv_cents / visitas) : 0,
      ultimaVisita: cliente.last_visit_at,
    },
    ciclo: cicloBruto
      ? {
          state: cicloBruto.state,
          lateDays: cicloBruto.late_days,
          predictedOn: cicloBruto.predicted_on,
          serviceName: cicloBruto.services?.name ?? '—',
        }
      : null,
    historico,
    mensagens: (mensagensBruto.data ?? []).map((m) => ({
      id: m.id,
      kind: m.kind,
      channel: m.channel,
      status: m.status,
      createdAt: m.created_at,
    })),
    indicadoPor: padrinhoBruto.data ?? null,
    indicados: indicadosBruto.data ?? [],
  }
}

export const SEGMENTOS_CAMPANHA = [
  { valor: 'sumidos', rotulo: 'Sumiram', descricao: 'Passaram do tempo de voltar' },
  { valor: 'aniversariantes', rotulo: 'Aniversariantes', descricao: 'Fazem aniversário este mês' },
  { valor: 'ticket_alto', rotulo: 'Melhores clientes', descricao: 'Os 25% que mais gastam' },
  { valor: 'primeira_visita', rotulo: 'Vieram só uma vez', descricao: 'Primeira visita sem retorno' },
  { valor: 'todos', rotulo: 'Toda a carteira', descricao: 'Todo mundo que aceita receber mensagem' },
] as const

export type SegmentoCampanha = (typeof SEGMENTOS_CAMPANHA)[number]['valor']

export type AlvoCampanha = { id: string; name: string; phoneE164: string | null; ltvCents: number }

/**
 * Quem entra numa campanha. Três regras valem para todo segmento, e não são negociáveis:
 * quem pediu para não receber (`whatsapp_opt_out`) fica de fora, quem nunca deu opt-in de
 * marketing fica de fora, e sem telefone não há como mandar. Filtrar isso aqui — e não na tela —
 * é o que impede um clique distraído de virar mensagem para quem já pediu para parar.
 */
export async function publicoDaCampanha(
  db: Cliente,
  tenantId: string,
  segmento: SegmentoCampanha,
): Promise<AlvoCampanha[]> {
  const elegiveis = () =>
    db
      .from('clients')
      .select('id, name, phone_e164, ltv_cents')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('whatsapp_opt_out', false)
      .eq('marketing_opt_in', true)
      .not('phone_e164', 'is', null)

  if (segmento === 'sumidos') {
    const { data: ciclos } = await db
      .from('client_cycles')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .in('state', ['late', 'at_risk', 'lost'])
    const ids = [...new Set((ciclos ?? []).map((c) => c.client_id))]
    if (ids.length === 0) return []
    const { data, error } = await elegiveis().in('id', ids).order('ltv_cents', { ascending: false })
    if (error) throw new AppError('INTERNAL', { cause: error })
    return (data ?? []).map(paraAlvo)
  }

  if (segmento === 'aniversariantes' || segmento === 'ticket_alto' || segmento === 'primeira_visita') {
    const coluna =
      segmento === 'aniversariantes'
        ? 'is_aniversariante'
        : segmento === 'ticket_alto'
          ? 'is_ticket_alto'
          : 'is_primeira_visita_sem_retorno'

    const { data: segmentados } = await db
      .from('v_client_segments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq(coluna, true)
    // Toda coluna de view chega nullable pelo tipo gerado, mesmo vindo de uma PK — o filtro
    // não é defensivo à toa, é o que faz o `.in()` receber `string[]` de verdade.
    const ids = (segmentados ?? []).map((c) => c.id).filter((id): id is string => id !== null)
    if (ids.length === 0) return []
    const { data, error } = await elegiveis().in('id', ids).order('ltv_cents', { ascending: false })
    if (error) throw new AppError('INTERNAL', { cause: error })
    return (data ?? []).map(paraAlvo)
  }

  const { data, error } = await elegiveis().order('ltv_cents', { ascending: false }).limit(500)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return (data ?? []).map(paraAlvo)
}

function paraAlvo(c: { id: string; name: string; phone_e164: string | null; ltv_cents: number }): AlvoCampanha {
  return { id: c.id, name: c.name, phoneE164: c.phone_e164, ltvCents: c.ltv_cents }
}

export const EsquemaCampanha = z.object({
  name: z.string().trim().min(2, 'Dê um nome à campanha.').max(80),
  segment: z.string().trim().max(40),
  template: z.string().trim().max(80),
  /** Quem realmente recebeu, não só quantos: sem os ids não há como atribuir receita depois. */
  clientIds: z.array(z.uuid()).min(1, 'Nenhuma mensagem foi enviada ainda.').max(2000),
})

/**
 * Registra a campanha depois que as mensagens saíram, e grava uma linha em `messages` por
 * pessoa. As linhas não são enfeite de histórico: a atribuição de receita (TICKET-039) procura
 * exatamente `messages` com `kind = 'campaign'` e `status = 'sent'` para creditar o agendamento
 * concluído dentro de 30 dias. Sem elas, `booked_count`/`revenue_cents` desta campanha ficariam
 * zerados para sempre e o funil da tela seria decorativo.
 *
 * `booked_count`/`revenue_cents` continuam nascendo em zero de propósito — quem preenche é a
 * atribuição, não o usuário: número de conversão digitado à mão não é medição, é opinião.
 */
export async function registrarCampanha(db: Cliente, tenantId: string, entrada: z.infer<typeof EsquemaCampanha>) {
  const { data, error } = await db
    .from('campaigns')
    .insert({
      tenant_id: tenantId,
      name: entrada.name,
      segment: { tipo: entrada.segment },
      template: entrada.template,
      status: 'done',
      sent_count: entrada.clientIds.length,
    })
    .select('id, name, sent_count, booked_count, revenue_cents')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })

  const agora = new Date().toISOString()
  const { error: erroMensagens } = await db.from('messages').insert(
    entrada.clientIds.map((clientId) => ({
      tenant_id: tenantId,
      client_id: clientId,
      channel: 'whatsapp' as const,
      kind: 'campaign' as const,
      // `sent` e não `queued`: a mensagem saiu de fato — quem apertou "enviar" foi a pessoa, no
      // WhatsApp dela. O que o sistema não sabe (e por isso não finge saber) é se foi entregue.
      status: 'sent' as const,
      template: entrada.template,
      sent_at: agora,
    })),
  )
  if (erroMensagens) throw new AppError('INTERNAL', { cause: erroMensagens })

  return data
}

export type PainelCarteira = {
  total: number
  novosNoMes: number
  aniversariantes: number
  emRisco: number
  ticketMedioCents: number
  taxaRetornoBps: number
}

/**
 * Os números do topo da lista de clientes. Contagens vêm por `head: true` (só o total, sem
 * trazer linha nenhuma) — a carteira de um salão grande tem milhares de clientes e nenhuma
 * dessas perguntas precisa dos dados em si.
 */
export async function painelDaCarteira(db: Cliente, tenantId: string): Promise<PainelCarteira> {
  const inicioDoMes = new Date()
  inicioDoMes.setUTCDate(1)
  inicioDoMes.setUTCHours(0, 0, 0, 0)

  const base = () => db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null)

  const [total, novos, aniversariantes, emRisco, agregados, comRetorno] = await Promise.all([
    base(),
    base().gte('created_at', inicioDoMes.toISOString()),
    db
      .from('v_client_segments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_aniversariante', true),
    db
      .from('client_cycles')
      .select('client_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('state', ['late', 'at_risk', 'lost']),
    db.from('clients').select('ltv_cents, visits_count').eq('tenant_id', tenantId).is('deleted_at', null),
    base().gt('visits_count', 1),
  ])

  const linhas = agregados.data ?? []
  const visitasTotais = linhas.reduce((s, c) => s + c.visits_count, 0)
  const ltvTotal = linhas.reduce((s, c) => s + c.ltv_cents, 0)
  const totalClientes = total.count ?? 0

  return {
    total: totalClientes,
    novosNoMes: novos.count ?? 0,
    aniversariantes: aniversariantes.count ?? 0,
    emRisco: emRisco.count ?? 0,
    ticketMedioCents: visitasTotais > 0 ? Math.round(ltvTotal / visitasTotais) : 0,
    // Basis points (regra 3 do CLAUDE.md): percentual nunca vira float solto.
    taxaRetornoBps: totalClientes > 0 ? Math.round(((comRetorno.count ?? 0) / totalClientes) * 10_000) : 0,
  }
}
