import { z } from 'zod'

import { alertaDoCliente } from '@/server/services/anamnese'
import { statusConsentimentos } from '@/server/services/consentimentos'
import { assinaturaAtiva, extratoDePontos, type AssinaturaDoCliente, type ExtratoPontos } from '@/server/services/fidelidade'
import { listarMediaDoCliente } from '@/server/services/media'
import { listarNotas, type NotaDoCliente } from '@/server/services/notas'
import { listarOrcamentos } from '@/server/services/orcamentos'
import { listarPacotesDoCliente, saldoCarteira } from '@/server/services/pacotes'
import { contextoDePlano } from '@/server/services/planos'
import { podeUsarModulo } from '@/core/billing/planos'

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
    document: string | null
    gender: string | null
    address: string | null
    emergencyContact: string | null
    preferredProfessionalId: string | null
    preferredProfessionalName: string | null
    onlineBookingBlocked: boolean
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
  notas: NotaDoCliente[]
  pontos: ExtratoPontos
  assinatura: AssinaturaDoCliente | null
  pacotes: { id: string; serviceName: string; restantes: number; total: number; expiresOn: string | null }[]
  saldoCarteiraCents: number
  fotos: { id: string; phase: string | null; createdAt: string }[]
  consentimentos: { kind: string; granted: boolean; grantedAt: string | null }[]
  /**
   * Só o SINAL de que existe alerta de saúde, nunca o conteúdo: abrir a ficha do cofre é ação
   * deliberada, que passa por `/vault` e fica registrada na trilha de acesso (TICKET-053).
   * Carregar o conteúdo aqui geraria um acesso registrado a cada abertura da tela.
   */
  saude: { temFicha: boolean; temAlerta: boolean; alerta: string | null }
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
      'id, name, phone_e164, email, birth_date, notes, tags, source, referred_by, preferences, document, gender, address, emergency_contact, preferred_professional_id, online_booking_blocked, marketing_opt_in, whatsapp_opt_out, visits_count, no_show_count, ltv_cents, last_visit_at, created_at, professionals!clients_preferred_professional_id_fkey(display_name)',
    )
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!cliente) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })

  const [
    historicoBruto,
    ciclosBruto,
    mensagensBruto,
    indicadosBruto,
    padrinhoBruto,
    notas,
    pontos,
    assinatura,
    pacotesBruto,
    saldoCarteiraCents,
    fotos,
    consentimentosBruto,
    saudeBruto,
    servicosBruto,
  ] = await Promise.all([
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
    listarNotas(db, tenantId, clientId),
    extratoDePontos(db, tenantId, clientId),
    assinaturaAtiva(db, tenantId, clientId),
    listarPacotesDoCliente(db, tenantId, clientId),
    saldoCarteira(db, tenantId, clientId),
    // Não recebe `db`: a mídia vive em bucket privado e o módulo resolve o acesso por conta.
    listarMediaDoCliente(tenantId, clientId),
    statusConsentimentos(db, tenantId, clientId),
    alertaDoCliente(db, tenantId, clientId),
    // `listarPacotesDoCliente` devolve `serviceId`, não o nome — o catálogo de um salão é
    // pequeno, então uma leitura resolve todos os pacotes de uma vez.
    db.from('services').select('id, name').eq('tenant_id', tenantId),
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
  const nomePorServico = new Map((servicosBruto.data ?? []).map((s) => [s.id, s.name]))

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
      document: cliente.document,
      gender: cliente.gender,
      address: cliente.address,
      emergencyContact: cliente.emergency_contact,
      preferredProfessionalId: cliente.preferred_professional_id,
      preferredProfessionalName: cliente.professionals?.display_name ?? null,
      onlineBookingBlocked: cliente.online_booking_blocked,
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
    notas,
    pontos,
    assinatura,
    pacotes: pacotesBruto.map((p) => ({
      id: p.id,
      serviceName: nomePorServico.get(p.serviceId) ?? 'Serviço removido',
      restantes: p.remainingSessions,
      total: p.totalSessions,
      expiresOn: p.expiresOn,
    })),
    saldoCarteiraCents,
    fotos,
    // `statusConsentimentos` devolve `null` para o tipo que nunca foi respondido — vira "não
    // concedido" na tela, que é o estado correto: silêncio nunca é consentimento.
    consentimentos: Object.entries(consentimentosBruto).map(([kind, s]) => ({
      kind,
      granted: s?.granted ?? false,
      grantedAt: s?.grantedAt ?? null,
    })),
    saude: {
      temFicha: saudeBruto.hasAlert || saudeBruto.alertLabel !== null,
      temAlerta: saudeBruto.hasAlert,
      alerta: saudeBruto.alertLabel,
    },
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
/**
 * Um `.in()` com centenas de uuids monta uma URL gigante e o PostgREST recusa por tamanho —
 * defeito já pago nesta base (ver `docs/DECISOES.md`, lotes de ~200 na busca por hash). Por isso
 * o filtro por id vai em lotes, nunca de uma vez.
 */
const TAMANHO_LOTE_IN = 200

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

  async function elegiveisEntre(ids: string[]): Promise<AlvoCampanha[]> {
    const encontrados: AlvoCampanha[] = []
    for (let i = 0; i < ids.length; i += TAMANHO_LOTE_IN) {
      const { data, error } = await elegiveis().in('id', ids.slice(i, i + TAMANHO_LOTE_IN))
      if (error) throw new AppError('INTERNAL', { cause: error })
      encontrados.push(...(data ?? []).map(paraAlvo))
    }
    // Ordenar aqui, e não no banco: com o filtro quebrado em lotes, cada consulta só ordena o
    // próprio pedaço — a lista final sairia embaralhada entre lotes.
    return encontrados.sort((a, b) => b.ltvCents - a.ltvCents)
  }

  if (segmento === 'sumidos') {
    const { data: ciclos, error } = await db
      .from('client_cycles')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .in('state', ['late', 'at_risk', 'lost'])
    if (error) throw new AppError('INTERNAL', { cause: error })
    return elegiveisEntre([...new Set((ciclos ?? []).map((c) => c.client_id))])
  }

  if (segmento === 'aniversariantes' || segmento === 'ticket_alto' || segmento === 'primeira_visita') {
    const coluna =
      segmento === 'aniversariantes'
        ? 'is_aniversariante'
        : segmento === 'ticket_alto'
          ? 'is_ticket_alto'
          : 'is_primeira_visita_sem_retorno'

    const { data: segmentados, error } = await db
      .from('v_client_segments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq(coluna, true)
    if (error) throw new AppError('INTERNAL', { cause: error })
    // Toda coluna de view chega nullable pelo tipo gerado, mesmo vindo de uma PK — o filtro
    // não é defensivo à toa, é o que faz o `.in()` receber `string[]` de verdade.
    return elegiveisEntre((segmentados ?? []).map((c) => c.id).filter((id): id is string => id !== null))
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

export type AcaoSugerida = {
  chave: string
  titulo: string
  descricao: string
  href: string
  tom: 'warn' | 'info' | 'ok'
}

/**
 * "Próximo passo sugerido", o padrão de next-best-action que a pesquisa de mercado validou
 * (customer health score só vale a pena quando dispara uma ação — thecxlead/digitalapplied). Em
 * vez de números soltos, a tela "Hoje" ganha uma lista do que vale a pena fazer agora, cada item
 * com link direto pra resolver. Nunca lança: um item que falhar de calcular só some da lista, a
 * tela "Hoje" não pode quebrar por causa de um resumo de CRM.
 */
export type CentralDeAcoes = {
  /** O título da seção muda de sentido numa conta que ainda não tem nada. */
  titulo: string
  acoes: AcaoSugerida[]
}

/**
 * Conta recém-criada não tem cliente, não tem ciclo e não tem aniversariante — então a central
 * nascia vazia e a tela principal do produto abria muda, sem dizer o que fazer primeiro. Estes
 * três passos são a sequência mínima até o primeiro atendimento entrar na agenda.
 */
const PRIMEIROS_PASSOS: AcaoSugerida[] = [
  {
    chave: 'inicio-servicos',
    titulo: 'Confira seus serviços e preços',
    descricao: 'O catálogo da sua profissão já veio preenchido. Ajuste preço e duração para o que você cobra de verdade.',
    href: '/admin/config/servicos',
    tom: 'info',
  },
  {
    chave: 'inicio-clientes',
    titulo: 'Traga sua lista de clientes',
    descricao: 'De uma planilha, com nome e telefone. É o que faz o Motor de Ciclo ter de quem cuidar.',
    href: '/admin/clientes/importar',
    tom: 'info',
  },
  {
    chave: 'inicio-agenda',
    titulo: 'Marque o primeiro horário',
    descricao: 'Cada atendimento concluído ensina ao sistema de quanto em quanto tempo aquela pessoa volta.',
    href: '/admin/agenda/novo',
    tom: 'ok',
  },
]

export async function centralDeAcoes(db: Cliente, tenantId: string): Promise<CentralDeAcoes> {
  // As seis consultas (mais o contexto de plano) saem juntas de propósito. Descobrir "é conta
  // nova?" antes de pedir o resto custaria um round-trip a mais em TODO carregamento de "Hoje" —
  // a tela mais aberta do produto — para economizar consultas vazias só em contas sem dado nenhum.
  //
  // 2026-08-30, docs/33-AUTOMACAO-AGENTE-PLANO.md §2.3/Etapa 2 (docs/26 §1 Fase C, revisada em
  // docs/33 §7.2): esta função JÁ ERA o "resumo proativo, sem LLM, calculado ao abrir o painel"
  // que a Fase C pedia — faltava só orçamento parado, que a Fase A do assistente já sabia
  // responder (`orcamentos_parados`) mas a tela "Hoje" nunca mostrava sem o dono perguntar.
  const [clientes, agendamentos, emRisco, aniversariantes, resgataveis, orcamentos, ctxPlano] = await Promise.all([
    db.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).is('deleted_at', null),
    db.from('appointments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    db.from('client_cycles').select('client_id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('state', ['late', 'at_risk', 'lost']),
    db.from('v_client_segments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_aniversariante', true),
    db.from('loyalty_entries').select('client_id, points').eq('tenant_id', tenantId),
    listarOrcamentos(db, tenantId),
    contextoDePlano(db, tenantId),
  ])

  // Sem cliente E sem agendamento é conta que ainda não começou — quem só usa
  // agendamento online tem cliente criado pela própria reserva, então os dois
  // zerados juntos é o teste honesto de "nada aconteceu aqui ainda".
  if ((clientes.count ?? 0) === 0 && (agendamentos.count ?? 0) === 0) {
    return { titulo: 'Primeiros passos', acoes: PRIMEIROS_PASSOS }
  }

  const acoes: AcaoSugerida[] = []

  const totalEmRisco = emRisco.count ?? 0
  if (totalEmRisco > 0) {
    acoes.push({
      chave: 'recuperar',
      titulo: `${totalEmRisco} ${totalEmRisco === 1 ? 'cliente está sumindo' : 'clientes estão sumindo'}`,
      descricao: 'Passaram do tempo de voltar. Uma campanha de "sentimos sua falta" tende a trazer parte de volta.',
      href: '/admin/recuperar',
      tom: 'warn',
    })
  }

  const totalAniversariantes = aniversariantes.count ?? 0
  if (totalAniversariantes > 0) {
    acoes.push({
      chave: 'aniversariantes',
      titulo: `${totalAniversariantes} ${totalAniversariantes === 1 ? 'aniversariante' : 'aniversariantes'} este mês`,
      descricao: 'Uma mensagem de parabéns com um mimo custa pouco e fortalece o vínculo.',
      href: '/admin/campanhas/nova',
      tom: 'info',
    })
  }

  // Saldo por cliente somado em memória — `loyalty_entries` de um salão típico não passa de
  // poucos milhares de linhas, não justifica uma view agregada só para este contador.
  const saldoPorCliente = new Map<string, number>()
  for (const l of resgataveis.data ?? []) {
    if (!l.client_id) continue
    saldoPorCliente.set(l.client_id, (saldoPorCliente.get(l.client_id) ?? 0) + l.points)
  }
  const comPontosAltos = [...saldoPorCliente.values()].filter((s) => s >= 80).length
  if (comPontosAltos > 0) {
    acoes.push({
      chave: 'pontos',
      titulo: `${comPontosAltos} ${comPontosAltos === 1 ? 'cliente perto do prêmio' : 'clientes perto do prêmio'}`,
      descricao: 'Lembrar quem já juntou bastante ponto é um bom motivo pra chamar de volta.',
      href: '/admin/clientes',
      tom: 'ok',
    })
  }

  // Só para quem tem o módulo — plano Grátis não tem orçamento, não faz sentido sugerir resolver
  // o que a conta não pode nem abrir. Mesma permissão que a ferramenta `orcamentos_parados` do
  // assistente já exige (`server/assistente/ferramentas.ts`).
  if (podeUsarModulo(ctxPlano, 'quotes').estado === 'liberado') {
    const parados = orcamentos.filter((o) => o.status === 'sent')
    if (parados.length > 0) {
      acoes.push({
        chave: 'orcamentos',
        titulo: `${parados.length} ${parados.length === 1 ? 'orçamento parado' : 'orçamentos parados'}`,
        descricao: 'Esperando resposta da cliente. Um lembrete pode ser o empurrão que faltava.',
        href: '/admin/orcamentos',
        tom: 'warn',
      })
    }
  }

  return { titulo: 'Vale a pena hoje', acoes }
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
 * Os números do topo da lista de clientes, em três consultas que não trazem linha de cliente
 * nenhuma: `v_carteira_resumo` (0018) já devolve total/novos/retorno/somas agregados no banco, e
 * as outras duas são contagens `head: true`. A versão anterior somava no Node depois de baixar
 * a carteira inteira — além do desperdício, o teto de 1000 linhas por `.select()` do PostgREST
 * (TICKET-036) faria a média sair errada em silêncio a partir do milésimo cliente.
 */
export async function painelDaCarteira(db: Cliente, tenantId: string): Promise<PainelCarteira> {
  const [resumo, aniversariantes, emRisco] = await Promise.all([
    db
      .from('v_carteira_resumo')
      .select('total, novos_mes, com_retorno, ltv_total, visitas_total')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
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
  ])

  // Tenant sem cliente nenhum não aparece na view (o `group by` não gera linha) — zero em tudo.
  const total = resumo.data?.total ?? 0
  const visitasTotais = resumo.data?.visitas_total ?? 0
  const ltvTotal = resumo.data?.ltv_total ?? 0

  return {
    total,
    novosNoMes: resumo.data?.novos_mes ?? 0,
    aniversariantes: aniversariantes.count ?? 0,
    emRisco: emRisco.count ?? 0,
    ticketMedioCents: visitasTotais > 0 ? Math.round(ltvTotal / visitasTotais) : 0,
    // Basis points (regra 3 do CLAUDE.md): percentual nunca vira float solto.
    taxaRetornoBps: total > 0 ? Math.round(((resumo.data?.com_retorno ?? 0) / total) * 10_000) : 0,
  }
}
