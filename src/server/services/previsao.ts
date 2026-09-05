import { calibrarCiclo, type PrevisaoResolvida } from '@/core/cycle/calibracao'
import { VERSAO_DO_MOTOR } from '@/core/cycle/compute'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * O registro do que o Motor previu — antes de saber o resultado.
 *
 * `client_cycles` é upsert: a cada recálculo, `predicted_on` é sobrescrito e a previsão anterior
 * some. Isso descarta o único ativo do produto que o tempo protege (`docs/45` §1.6): um
 * concorrente com anos de histórico de agendamento deriva `personal_cycle_days` e `predicted_on`
 * em batch, mas **não consegue reconstruir o que um motor teria previsto e se teria acertado** —
 * previsão feita depois do fato não é previsão.
 *
 * Este módulo tem duas metades, e as duas rodam dentro do mesmo recálculo:
 *
 * 1. **Registrar** — uma linha por visita, escrita uma vez e nunca mais tocada.
 * 2. **Resolver** — quando a pessoa volta, a previsão em aberto daquela visita ganha o resultado.
 */

/** Uma previsão pronta para virar linha, montada por quem já calculou o ciclo. */
export type PrevisaoParaRegistrar = {
  clientId: string
  serviceId: string
  /** A visita que originou a previsão — é o que torna a linha única. */
  lastVisitOn: string
  predictedOn: string
  personalCycleDays: number
  defaultCycleDays: number
}

const TAMANHO_DO_LOTE = 1000

/**
 * Grava as previsões novas, ignorando as que já existem.
 *
 * `ignoreDuplicates` é o que torna o job diário barato E honesto ao mesmo tempo. Barato porque o
 * `recompute-cycles` roda todos os dias e a esmagadora maioria das combinações não teve visita
 * nova — sem isso, cada cliente geraria 365 linhas idênticas por ano. Honesto porque a primeira
 * gravação é a única: reescrever a previsão depois, com informação que na época não existia, é a
 * mesma coisa que não registrar nada.
 */
export async function registrarPrevisoes(db: Cliente, tenantId: string, previsoes: PrevisaoParaRegistrar[]): Promise<number> {
  if (previsoes.length === 0) return 0

  const linhas = previsoes.map((p) => ({
    tenant_id: tenantId,
    client_id: p.clientId,
    service_id: p.serviceId,
    last_visit_on: p.lastVisitOn,
    predicted_on: p.predictedOn,
    personal_cycle_days: p.personalCycleDays,
    default_cycle_days: p.defaultCycleDays,
    algo_version: VERSAO_DO_MOTOR,
  }))

  for (let inicio = 0; inicio < linhas.length; inicio += TAMANHO_DO_LOTE) {
    const { error } = await db
      .from('cycle_predictions')
      .upsert(linhas.slice(inicio, inicio + TAMANHO_DO_LOTE), {
        onConflict: 'tenant_id,client_id,service_id,last_visit_on',
        ignoreDuplicates: true,
      })
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  return linhas.length
}

/**
 * Fecha as previsões cujo resultado já é conhecido.
 *
 * `historicoPorCombinacao` é o mesmo mapa que o recálculo já montou — as datas de atendimento
 * concluído, ordenadas, por `clientId:serviceId`. Para uma previsão feita depois da visita do dia
 * D, o resultado é **a primeira visita seguinte a D**. Se não houver nenhuma, a previsão continua
 * em aberto: a pessoa ainda pode voltar, e fechá-la como "não voltou" seria inventar um fato.
 *
 * Só toca linha com `resolved_at is null`, então rodar duas vezes no mesmo dia é idêntico a rodar
 * uma. O resultado nunca é reescrito depois de conhecido.
 */
export async function resolverPrevisoes(
  db: Cliente,
  tenantId: string,
  historicoPorCombinacao: Map<string, string[]>,
): Promise<number> {
  const abertas = await buscarTudoPaginado(() =>
    db
      .from('cycle_predictions')
      .select('id, client_id, service_id, last_visit_on')
      .eq('tenant_id', tenantId)
      .is('resolved_at', null)
      .order('id'),
  )
  if (abertas.length === 0) return 0

  const agora = new Date().toISOString()
  let fechadas = 0

  for (const aberta of abertas) {
    const visitas = historicoPorCombinacao.get(`${aberta.client_id}:${aberta.service_id}`)
    if (!visitas) continue

    // A primeira visita ESTRITAMENTE depois da que originou a previsão. Duas visitas no mesmo dia
    // não fecham uma à outra — seriam corte e barba no mesmo atendimento, não um retorno.
    const retorno = visitas.find((d) => d > aberta.last_visit_on)
    if (!retorno) continue

    /*
      `.select('id')` não é enfeite: no supabase-js um `update` que não casa linha nenhuma devolve
      `error: null`, e aqui o `where` tem uma GUARDA além da identidade (`resolved_at is null`).
      Sem pedir as linhas de volta, uma execução simultânea que já tivesse fechado esta previsão
      faria o contador subir do mesmo jeito, e o job relataria um trabalho que não fez.

      Zero linhas aqui é inofensivo — quer dizer que alguém chegou antes — mas só é inofensivo
      porque não conta.
    */
    const { data: mudadas, error } = await db
      .from('cycle_predictions')
      .update({ actual_return_on: retorno, resolved_at: agora })
      .eq('tenant_id', tenantId)
      .eq('id', aberta.id)
      .is('resolved_at', null)
      .select('id')
    if (error) throw new AppError('INTERNAL', { cause: error })
    fechadas += mudadas?.length ?? 0
  }

  return fechadas
}

/**
 * Mede a cadência real de cada serviço e guarda o resultado AO LADO da régua configurada.
 *
 * Roda depois de `resolverPrevisoes`, no mesmo recálculo, e o efeito aparece na passada SEGUINTE —
 * o `computeCycle` desta execução já leu os ciclos antes. Um dia de atraso num número que descreve
 * um comportamento de semanas não muda decisão nenhuma, e evitar isso exigiria carregar as
 * previsões antes de tudo, encarecendo o caminho quente do job para nada.
 *
 * `cycleDaysPorServico` é a régua EFETIVA de cada serviço hoje (observada, se houver; configurada,
 * se não) — é contra ela que o desvio mínimo é medido, senão a calibração recalcularia a mesma
 * correção todo dia e reescreveria a linha para sempre.
 */
export async function calibrarServicos(db: Cliente, tenantId: string, cicloEfetivoPorServico: Map<string, number>): Promise<number> {
  const resolvidas = await buscarTudoPaginado(() =>
    db
      .from('cycle_predictions')
      .select('service_id, last_visit_on, actual_return_on')
      .eq('tenant_id', tenantId)
      .not('resolved_at', 'is', null)
      .order('id'),
  )
  if (resolvidas.length === 0) return 0

  const porServico = new Map<string, PrevisaoResolvida[]>()
  for (const linha of resolvidas) {
    // `actual_return_on` é nulo enquanto a previsão está em aberto; o filtro acima já as tira, e
    // esta guarda é o que faz o tipo bater sem `as`.
    if (!linha.actual_return_on) continue
    const lista = porServico.get(linha.service_id) ?? []
    lista.push({ lastVisitOn: linha.last_visit_on, actualReturnOn: linha.actual_return_on })
    porServico.set(linha.service_id, lista)
  }

  const agora = new Date().toISOString()
  let calibrados = 0

  for (const [serviceId, voltas] of porServico) {
    const efetivo = cicloEfetivoPorServico.get(serviceId)
    if (efetivo === undefined) continue // serviço apagado entre a leitura e agora

    const { diasMedidos, amostra } = calibrarCiclo(voltas, efetivo)
    if (diasMedidos === null) continue

    const { error } = await db
      .from('services')
      .update({ cycle_days_observado: diasMedidos, cycle_days_observado_amostra: amostra, cycle_days_observado_em: agora })
      .eq('tenant_id', tenantId)
      .eq('id', serviceId)
    if (error) throw new AppError('INTERNAL', { cause: error })
    calibrados++
  }

  return calibrados
}
