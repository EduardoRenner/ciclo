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
export const VERSAO_DO_MOTOR = 4

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

/**
 * Exportada desde esta sessão: `prestacao-de-contas.ts` e `calibracao.ts` tinham cada uma a sua
 * própria cópia, byte a byte idêntica — a mesma classe de "duas cópias da mesma fórmula" já
 * registrada nesta base para `diasEntre`/`estadoPorAtraso`.
 */
export function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  if (ordenados.length % 2 === 0) return (ordenados[meio - 1]! + ordenados[meio]!) / 2
  return ordenados[meio]!
}

/**
 * Exportada desde `docs/73` T3: `calibrar-probabilidade.ts` reaplica a MESMA régua de atraso →
 * estado sobre o atraso que a previsão tinha ao ser resolvida (não ao ser calculada hoje), para
 * calibrar `PROBABILIDADE_POR_ESTADO`. Uma segunda cópia desta função divergiria da primeira na
 * primeira mudança de faixa — a mesma armadilha de "duas cópias da mesma fórmula" já registrada
 * nesta base.
 */
/**
 * Pesos dos últimos 5 intervalos, do mais antigo ao mais recente (v3, docs/105-ciclo/C-006).
 * Quem está desacelerando (21 → 35 dias) era previsto pelo meio da série; com os 2 mais recentes valendo
 * o dobro, o acerto na semana nesse cliente foi de 85% para 92% no backtest, sem piorar nenhum outro
 * cenário (varredura de 4 conjuntos de pesos registrada no ciclo). Peso maior que 2 começava a seguir o
 * "pulo" (o cliente que falta uma vez) e piorava o 'padrão errado'.
 */
export const PESOS_RECENTES = [1, 1, 1, 2, 2] as const

/**
 * Mediana ponderada: o valor em que o peso acumulado (em ordem crescente de valor) chega à metade do
 * total. Com pesos iguais é a mediana comum. Os pesos alinham pelo FIM da lista (o mais recente pesa mais).
 */
export function medianaPonderada(valores: readonly number[], pesos: readonly number[]): number {
  const p = pesos.slice(-valores.length)
  const pares = valores.map((v, i) => ({ v, w: p[i] ?? 1 })).sort((a, b) => a.v - b.v)
  const total = pares.reduce((s, x) => s + x.w, 0)
  let acumulado = 0
  for (let i = 0; i < pares.length; i++) {
    acumulado += pares[i]!.w
    if (acumulado > total / 2) return pares[i]!.v
    if (acumulado === total / 2) return (pares[i]!.v + pares[i + 1]!.v) / 2
  }
  return pares[pares.length - 1]!.v
}

export function estadoPorAtraso(lateDays: number): EstadoCiclo {
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

  const { gaps, referencia, provadoPorConcordancia } = intervalosDoRitmo(history, defaultCycleDays)

  // 3. 0 gaps → só o padrão. 1-2 → mistura com o padrão (v4: sem mistura quando os 2 concordam fora
  // da régua do padrão — o padrão ali está errado, misturar puxaria de volta para ele). 3+ → mediana
  // ponderada dos últimos 5.
  let personalCycleDays: number
  if (gaps.length === 0) {
    personalCycleDays = defaultCycleDays
  } else if (gaps.length <= 2) {
    personalCycleDays = provadoPorConcordancia ? mediana(gaps) : 0.6 * mediana(gaps) + 0.4 * defaultCycleDays
  } else {
    personalCycleDays = medianaPonderada(gaps.slice(-5), PESOS_RECENTES)
  }

  // 4. clamp entre 0,5× e 2,5× a referência — um outlier não pode esticar o ciclo pra sempre. Na v2,
  // com ritmo provado, a referência é o próprio cliente (o mesmo motivo do passo 2).
  personalCycleDays = Math.min(Math.max(personalCycleDays, 0.5 * referencia), 2.5 * referencia)

  // 5. predictedDate = último atendimento + personalCycleDays.
  const ultimoAtendimento = history[history.length - 1]!.date
  const predictedDate = ultimoAtendimento.add({ days: Math.round(personalCycleDays) })
  // 6. lateDays = hoje − predictedDate.
  const lateDays = today.since(predictedDate).total('days')

  // 7. estado, pelas faixas de `estadoPorAtraso` — 8. agendamento futuro já marcado: não
  // incomodar quem já vai voltar (sobrepõe o resultado do passo 7).
  const state = entrada.hasFutureAppointment ? 'on_track' : estadoPorAtraso(lateDays)

  return { personalCycleDays, predictedDate, lateDays, state }
}

/**
 * Passos 1 e 2 do `computeCycle`, exportados para que a faixa de incerteza (`incerteza.ts`) meça a
 * dispersão dos MESMOS intervalos que o Motor usou — uma cópia do filtro lá divergiria daqui.
 */
export function intervalosDoRitmo(
  history: readonly { date: Temporal.PlainDate }[],
  defaultCycleDays: number,
): { gapsBrutos: number[]; gaps: number[]; referencia: number; ritmoProvado: boolean; provadoPorConcordancia: boolean } {
  // 1. gaps = diferenças em dias entre atendimentos consecutivos.
  const gapsBrutos: number[] = []
  for (let i = 1; i < history.length; i++) {
    gapsBrutos.push(history[i]!.date.since(history[i - 1]!.date).total('days'))
  }

  // 2. descartar gaps anômalos (sumiu e voltou não é ritmo, é exceção).
  //
  // v2 (docs/105-ciclo/C-001): com 3+ intervalos, a régua do que é "anômalo" é o PRÓPRIO cliente
  // (3× a mediana dele), não o padrão do serviço. O padrão é um palpite de catálogo
  // (`calibracao.ts`: "nunca foi uma escolha do dono") e, quando está errado, a v1 descartava todos
  // os intervalos de quem tem ritmo próprio longo: medido no backtest, cliente de 70 dias num
  // serviço de padrão 21 tinha erro mediano de 44 dias e 0% de acerto na semana. Com 0–2
  // intervalos não há ritmo provado e nada muda: o padrão segue sendo a referência.
  //
  // v4 (docs/105-ciclo/C-011): com exatamente 2 intervalos que CONCORDAM entre si (o maior até 1,5× o
  // menor) e caem os dois FORA da régua do padrão (acima de 3× ou abaixo de metade), o ritmo também
  // está provado. Na v3 os dois eram descartados como anomalia e o cliente de 70 dias num serviço de
  // padrão 21 era previsto para voltar em 21: medido, acerto na semana 66% → 79% nesse cenário, e
  // nenhum outro cenário mudou um ponto. Exigir os DOIS fora do padrão é o que protege o resto: a
  // variante sem essa exigência ganhava 1 ponto na deriva e perdia 1 no errático (rejeitada).
  const [a, b] = gapsBrutos
  const provadoPorConcordancia =
    gapsBrutos.length === 2 &&
    Math.max(a!, b!) <= 1.5 * Math.max(1, Math.min(a!, b!)) &&
    (Math.min(a!, b!) > 3 * defaultCycleDays || Math.max(a!, b!) < defaultCycleDays / 2)
  const ritmoProvado = gapsBrutos.length >= 3 || provadoPorConcordancia
  const referencia = ritmoProvado ? mediana(gapsBrutos) : defaultCycleDays
  const gaps = gapsBrutos.filter((g) => g <= 3 * referencia)
  return { gapsBrutos, gaps, referencia, ritmoProvado, provadoPorConcordancia }
}
