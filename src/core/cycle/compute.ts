import { Temporal } from '@js-temporal/polyfill'

/** `§5.3`, literal. */
export type EstadoCiclo = 'on_track' | 'due' | 'late' | 'at_risk' | 'lost'

/**
 * Versão do algoritmo de previsão, gravada em cada linha de `cycle_predictions`.
 *
 * **Suba isto sempre que mudar qualquer coisa que altere o resultado de `computeCycle`** — os
 * pesos da mistura, o corte de intervalos anômalos, as faixas de `estadoPorAtraso`, o teto e o
 * piso do ciclo pessoal.
 *
 * Sem a versão, a série histórica de previsões mistura eras do algoritmo em silêncio: a
 * calibração passaria a comparar o que o Motor de hoje previu com o que o Motor de seis meses
 * atrás previa, concluiria que o erro mudou, e atribuiria à clientela uma mudança que foi nossa.
 * É a versão que permite separar "o salão mudou" de "nós mudamos".
 */
export const VERSAO_DO_MOTOR = 1

export type EntradaComputeCycle = {
  /** Atendimentos concluídos daquele cliente naquele serviço, em ordem cronológica. */
  history: { date: Temporal.PlainDate }[]
  defaultCycleDays: number
  today: Temporal.PlainDate
  /** `§5.3.8`: agendamento futuro já marcado força on_track — não incomodar quem já vai voltar. */
  hasFutureAppointment?: boolean
}

export type ResultadoComputeCycle = {
  personalCycleDays: number
  predictedDate: Temporal.PlainDate
  lateDays: number
  state: EstadoCiclo
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  if (ordenados.length % 2 === 0) return (ordenados[meio - 1]! + ordenados[meio]!) / 2
  return ordenados[meio]!
}

function estadoPorAtraso(lateDays: number): EstadoCiclo {
  if (lateDays < -3) return 'on_track'
  if (lateDays <= 0) return 'due'
  if (lateDays <= 10) return 'late'
  if (lateDays <= 30) return 'at_risk'
  return 'lost'
}

/**
 * `01-ESPEC-TECNICA §5.3` — determinístico, sem ML, cada passo numerado ali
 * vira um comentário aqui na mesma ordem, para dar pra conferir os dois lado
 * a lado.
 */
export function computeCycle(entrada: EntradaComputeCycle): ResultadoComputeCycle {
  const { history, defaultCycleDays, today } = entrada

  // Sem nenhum atendimento, não existe "última visita" para prever a partir
  // dela — o algoritmo de gaps pressupõe pelo menos um ponto de partida. Um
  // cliente que nunca veio não está "atrasado para voltar": ele nunca foi.
  if (history.length === 0) {
    return { personalCycleDays: defaultCycleDays, predictedDate: today, lateDays: 0, state: 'on_track' }
  }

  const gapsBrutos: number[] = []
  for (let i = 1; i < history.length; i++) {
    gapsBrutos.push(history[i]!.date.since(history[i - 1]!.date).total('days'))
  }

  // 2. descartar gaps > 3× o padrão (sumiu e voltou não é ritmo, é exceção).
  const gaps = gapsBrutos.filter((g) => g <= 3 * defaultCycleDays)

  // 3. 0 gaps → só o padrão. 1-2 → mistura com o padrão. 3+ → mediana dos últimos 5.
  let personalCycleDays: number
  if (gaps.length === 0) {
    personalCycleDays = defaultCycleDays
  } else if (gaps.length <= 2) {
    personalCycleDays = 0.6 * mediana(gaps) + 0.4 * defaultCycleDays
  } else {
    personalCycleDays = mediana(gaps.slice(-5))
  }

  // 4. clamp entre 0,5× e 2,5× o padrão — um outlier não pode esticar o ciclo pra sempre.
  personalCycleDays = Math.min(Math.max(personalCycleDays, 0.5 * defaultCycleDays), 2.5 * defaultCycleDays)

  const ultimoAtendimento = history[history.length - 1]!.date
  const predictedDate = ultimoAtendimento.add({ days: Math.round(personalCycleDays) })
  const lateDays = today.since(predictedDate).total('days')

  // 8. agendamento futuro já marcado: não incomodar quem já vai voltar.
  const state = entrada.hasFutureAppointment ? 'on_track' : estadoPorAtraso(lateDays)

  return { personalCycleDays, predictedDate, lateDays, state }
}
