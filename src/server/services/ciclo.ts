import { Temporal } from '@js-temporal/polyfill'

import { reguaEfetivaDias } from '@/core/ciclo/regua-do-servico'
import { computeCycle } from '@/core/cycle/compute'
import { valorEmRiscoCents } from '@/core/cycle/valor-em-risco'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { calibrarServicos, registrarPrevisoes, resolverPrevisoes, type PrevisaoParaRegistrar } from '@/server/services/previsao'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/** Tamanho do LOTE DE ESCRITA do upsert — outra decisão que o teto de leitura do PostgREST. */
const TAMANHO_DO_LOTE = 1000


/**
 * Um `(client_id, service_id)` só entra no cálculo se tiver pelo menos um
 * atendimento concluído — cliente que nunca veio para aquele serviço não tem
 * ciclo nenhum a acompanhar (mesma regra de `computeCycle` para histórico vazio,
 * só que aqui a linha nem chega a existir em vez de existir com estado neutro).
 */
type Combinacao = { clientId: string; serviceId: string }

/*
 * `valorEmRiscoCents` mudou para `@/core/cycle/valor-em-risco` (import no topo). Era `preço ×
 * fator`, sem I/O, mas morava aqui — e a consequência não era estética: a tabela que ORDENA a tela
 * "Recuperar receita" só dava para exercitar pelo teste de integração, que precisa de banco no ar,
 * enquanto a outra metade do mesmo `§5.3` (o estado, em `core/cycle/compute.ts`) tinha teste de
 * unidade desde sempre.
 */

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
    buscarTudoPaginado(() =>
      db.from('services').select('id, cycle_days, cycle_days_observado, price_cents').eq('tenant_id', tenantId).order('id'),
    ),
  ])

  /*
    A régua EFETIVA: a medida quando existe, a configurada quando não.

    `cycle_days` é palpite de catálogo (21 da coluna, ou o do pack da profissão) aplicado a todo
    salão do país; `cycle_days_observado` é a cadência que a clientela DESTE salão de fato tem,
    medida a partir das voltas que aconteceram (`core/cycle/calibracao.ts`). Preferir a medida é o
    ponto inteiro do mecanismo — e a configurada continua intacta na outra coluna, para o dono
    poder comparar e para a correção ser reversível.
  */
  const cycleDaysPorServico = new Map(servicos.map((s) => [s.id, reguaEfetivaDias(s.cycle_days, s.cycle_days_observado)]))
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

  /*
    O registro de previsão (`docs/46`) anda de carona neste laço de propósito: as datas de visita
    já estão carregadas e ordenadas aqui, e buscá-las de novo num job à parte seria repetir a
    consulta mais cara do produto para chegar no mesmo dado.
  */
  const previsoes: PrevisaoParaRegistrar[] = []
  const datasPorCombinacao = new Map<string, string[]>()

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

    const ultimaVisita = history[history.length - 1]!.date.toString()
    datasPorCombinacao.set(chave, history.map((h) => h.date.toString()))
    previsoes.push({
      clientId,
      serviceId,
      lastVisitOn: ultimaVisita,
      predictedOn: resultado.predictedDate.toString(),
      // A tabela exige > 0, e o piso do ciclo pessoal é 0.5 do padrão: sem o `max`, um serviço de
      // ciclo 1 produziria 0 e derrubaria o cron inteiro por violação de constraint.
      personalCycleDays: Math.max(1, Math.round(resultado.personalCycleDays)),
      defaultCycleDays,
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
  for (let inicio = 0; inicio < linhas.length; inicio += TAMANHO_DO_LOTE) {
    const lote = linhas.slice(inicio, inicio + TAMANHO_DO_LOTE)
    const { error } = await db.from('client_cycles').upsert(lote, { onConflict: 'tenant_id,client_id,service_id' })
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  /*
    Registrar DEPOIS de gravar `client_cycles`, e resolver DEPOIS de registrar.

    A ordem importa: se o registro falhasse antes do upsert, o produto ficaria sem o recálculo (o
    que a tela mostra) por causa da trilha (o que ninguém vê hoje). E resolver antes de registrar
    perderia o caso do cliente que voltou no mesmo dia em que a previsão anterior seria escrita.
  */
  await registrarPrevisoes(db, tenantId, previsoes)
  await resolverPrevisoes(db, tenantId, datasPorCombinacao)
  await calibrarServicos(db, tenantId, cycleDaysPorServico)

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
    db.from('services').select('cycle_days, cycle_days_observado, price_cents').eq('id', combinacao.serviceId).maybeSingle(),
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
    // A MESMA régua do job noturno. Ler `cycle_days` sozinho aqui fazia concluir um atendimento
    // reverter a previsão para o palpite de catálogo até a madrugada seguinte corrigir.
    defaultCycleDays: reguaEfetivaDias(servico.data.cycle_days, servico.data.cycle_days_observado),
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
