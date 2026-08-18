import { Temporal } from '@js-temporal/polyfill'

import { computeCycle } from '@/core/cycle/compute'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const TAMANHO_PAGINA = 1000

/**
 * O PostgREST devolve no máximo 1000 linhas por chamada, mesmo sem `.limit()`
 * — um tenant de 10 mil atendimentos concluídos silenciosamente perderia
 * 90% deles sem essa paginação (foi assim que o teste de performance do
 * TICKET-036 pegou o bug: "processados" deu 1000, não 10000).
 */
async function buscarTudoPaginado<T>(
  consultaBase: () => { range(inicio: number, fim: number): PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<T[]> {
  const tudo: T[] = []
  for (let pagina = 0; ; pagina++) {
    const inicio = pagina * TAMANHO_PAGINA
    const { data, error } = await consultaBase().range(inicio, inicio + TAMANHO_PAGINA - 1)
    if (error) throw new AppError('INTERNAL', { cause: error })
    tudo.push(...(data ?? []))
    if (!data || data.length < TAMANHO_PAGINA) break
  }
  return tudo
}

/**
 * Um `(client_id, service_id)` só entra no cálculo se tiver pelo menos um
 * atendimento concluído — cliente que nunca veio para aquele serviço não tem
 * ciclo nenhum a acompanhar (mesma regra de `computeCycle` para histórico vazio,
 * só que aqui a linha nem chega a existir em vez de existir com estado neutro).
 */
type Combinacao = { clientId: string; serviceId: string }

/**
 * §5.3, "Valor em risco": `preço atual do serviço × probabilidade de
 * recuperação por estado`. `on_track` não entra na tela de recuperação
 * (a view `v_recover_revenue` já filtra por estado), mas o job roda para
 * todo estado — 0 aqui é o valor correto para quem não está em risco.
 */
const PROBABILIDADE_POR_ESTADO: Record<string, number> = {
  on_track: 0,
  due: 0.85,
  late: 0.65,
  at_risk: 0.35,
  lost: 0.12,
}

function valorEmRiscoCents(priceCents: number, state: string): number {
  const probabilidade = PROBABILIDADE_POR_ESTADO[state] ?? 0
  // "sempre arredondado para baixo" — nunca prometer mais do que entrega.
  return Math.floor(priceCents * probabilidade)
}

/**
 * TICKET-036. Recalcula `client_cycles` de um tenant inteiro numa passada só:
 * carrega tudo em poucas consultas (não uma por cliente) e resolve em
 * memória — é o que faz "10 mil clientes em <60s" ser possível.
 */
export async function recomputarCiclosDoTenant(db: Cliente, tenantId: string, timezone: string, today: string): Promise<number> {
  // `.order('id')` em toda consulta paginada não é enfeite: sem ordem
  // explícita, o Postgres não garante a mesma ordem de linhas entre duas
  // chamadas `.range()` separadas — paginar "às cegas" pode pular ou repetir
  // linha entre uma página e outra. Foi assim que o teste de 10 mil clientes
  // pegou isto: `processados` variava a cada execução (1000, depois 7902).
  const [concluidos, futuros, servicos] = await Promise.all([
    buscarTudoPaginado(() =>
      db
        .from('appointments')
        .select('client_id, service_id, starts_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'done')
        .order('id'),
    ),
    buscarTudoPaginado(() =>
      db
        .from('appointments')
        .select('client_id, service_id')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'confirmed', 'arrived'])
        .order('id'),
    ),
    buscarTudoPaginado(() => db.from('services').select('id, cycle_days, price_cents').eq('tenant_id', tenantId).order('id')),
  ])

  const cycleDaysPorServico = new Map(servicos.map((s) => [s.id, s.cycle_days]))
  const precoPorServico = new Map(servicos.map((s) => [s.id, s.price_cents]))

  const temFuturoPorCombinacao = new Set(futuros.filter((a) => a.client_id).map((a) => `${a.client_id}:${a.service_id}`))

  const historicoPorCombinacao = new Map<string, string[]>()
  for (const ag of concluidos) {
    if (!ag.client_id) continue
    const chave = `${ag.client_id}:${ag.service_id}`
    const lista = historicoPorCombinacao.get(chave) ?? []
    lista.push(ag.starts_at)
    historicoPorCombinacao.set(chave, lista)
  }

  const hoje = Temporal.PlainDate.from(today)
  const linhas: Database['public']['Tables']['client_cycles']['Insert'][] = []

  for (const [chave, datas] of historicoPorCombinacao) {
    const [clientId, serviceId] = chave.split(':') as [string, string]
    const defaultCycleDays = cycleDaysPorServico.get(serviceId)
    if (!defaultCycleDays) continue // serviço apagado/desconhecido — sem padrão, sem como calcular

    const history = datas
      .map((iso) => Temporal.Instant.from(iso).toZonedDateTimeISO(timezone).toPlainDate())
      .sort((a, b) => Temporal.PlainDate.compare(a, b))
      .map((date) => ({ date }))

    const resultado = computeCycle({
      history,
      defaultCycleDays,
      today: hoje,
      hasFutureAppointment: temFuturoPorCombinacao.has(chave),
    })

    linhas.push({
      tenant_id: tenantId,
      client_id: clientId,
      service_id: serviceId,
      personal_cycle_days: Math.round(resultado.personalCycleDays),
      last_visit_on: history[history.length - 1]!.date.toString(),
      predicted_on: resultado.predictedDate.toString(),
      late_days: Math.trunc(resultado.lateDays),
      state: resultado.state,
      value_at_risk_cents: valorEmRiscoCents(precoPorServico.get(serviceId) ?? 0, resultado.state),
      computed_at: new Date().toISOString(),
    })
  }

  if (linhas.length === 0) return 0

  // upsert por (tenant_id, client_id, service_id) — a PK composta da 0001 —
  // é o que torna rodar o job duas vezes seguidas idêntico a rodar uma vez.
  // Em lotes de 1000: um único upsert com 10 mil linhas arrisca estourar
  // limite de corpo da requisição.
  for (let inicio = 0; inicio < linhas.length; inicio += TAMANHO_PAGINA) {
    const lote = linhas.slice(inicio, inicio + TAMANHO_PAGINA)
    const { error } = await db.from('client_cycles').upsert(lote, { onConflict: 'tenant_id,client_id,service_id' })
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return linhas.length
}

/**
 * "Recalcula em tempo real quando um atendimento é concluído" (§5.3) — só a
 * combinação daquele agendamento, não o tenant inteiro. Chamada por quem
 * conclui (TICKET-024), depois que o `done` já está gravado.
 */
export async function recomputarCicloDeUmAtendimento(
  db: Cliente,
  tenantId: string,
  timezone: string,
  combinacao: Combinacao,
  today: string,
): Promise<void> {
  const [concluidos, futuros, servico] = await Promise.all([
    db
      .from('appointments')
      .select('starts_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', combinacao.clientId)
      .eq('service_id', combinacao.serviceId)
      .eq('status', 'done'),
    db
      .from('appointments')
      .select('id', { head: true, count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('client_id', combinacao.clientId)
      .eq('service_id', combinacao.serviceId)
      .in('status', ['pending', 'confirmed', 'arrived']),
    db.from('services').select('cycle_days, price_cents').eq('id', combinacao.serviceId).maybeSingle(),
  ])
  if (concluidos.error) throw new AppError('INTERNAL', { cause: concluidos.error })
  if (futuros.error) throw new AppError('INTERNAL', { cause: futuros.error })
  if (servico.error) throw new AppError('INTERNAL', { cause: servico.error })
  if (!servico.data) return

  const history = (concluidos.data ?? [])
    .map((a) => Temporal.Instant.from(a.starts_at).toZonedDateTimeISO(timezone).toPlainDate())
    .sort((a, b) => Temporal.PlainDate.compare(a, b))
    .map((date) => ({ date }))
  if (history.length === 0) return

  const resultado = computeCycle({
    history,
    defaultCycleDays: servico.data.cycle_days,
    today: Temporal.PlainDate.from(today),
    hasFutureAppointment: (futuros.count ?? 0) > 0,
  })

  const { error } = await db.from('client_cycles').upsert(
    {
      tenant_id: tenantId,
      client_id: combinacao.clientId,
      service_id: combinacao.serviceId,
      personal_cycle_days: Math.round(resultado.personalCycleDays),
      last_visit_on: history[history.length - 1]!.date.toString(),
      predicted_on: resultado.predictedDate.toString(),
      late_days: Math.trunc(resultado.lateDays),
      state: resultado.state,
      value_at_risk_cents: valorEmRiscoCents(servico.data.price_cents, resultado.state),
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,client_id,service_id' },
  )
  if (error) throw new AppError('INTERNAL', { cause: error })
}
