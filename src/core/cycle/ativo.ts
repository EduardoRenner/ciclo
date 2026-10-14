import { Temporal } from '@js-temporal/polyfill'

import { computeCycle, intervalosDoRitmo, mediana, type EntradaComputeCycle } from './compute'

/**
 * Probabilidade de o cliente AINDA ESTAR ATIVO (`docs/105-ciclo/C-014`, hipóteses H1 + H3 do plano 98).
 *
 * A tabela de hoje (`PROBABILIDADE_POR_ESTADO`) dá a mesma chance a todo "atrasado": quem veio 12 vezes
 * como relógio e sumiu há 2 ciclos e quem veio 3 vezes de qualquer jeito. A ideia dos modelos de
 * "compra até sair" (Fader, Hardie e Lee 2005), sem a premissa de Poisson que o ciclo regular desmente:
 *
 *   P(ativo | silêncio t) = (1 − h) · S(t) / ((1 − h) · S(t) + h)
 *
 * - S(t): chance de um cliente que SEGUE ativo ficar t dias sem vir, tirada do ritmo DELE (centro =
 *   ciclo pessoal do Motor; espalhamento = MAD dos intervalos, ou 30% do ciclo sem ritmo provado), com
 *   uma parcela `q` de "pulou uma vez" (centro no dobro). Mais visitas → espalhamento conhecido → o
 *   mesmo silêncio vira evidência mais forte. É aí que o número de visitas entra (H3).
 * - h: chance a priori de ter saído desde a última visita. Calibrável por salão; o padrão é um
 *   palpite declarado, não um número medido.
 *
 * Continua explicável: "vem a cada 21 dias com folga de 3; já são 50: é pouco provável que siga vindo".
 */

export const RISCO_DE_SAIDA_POR_VISITA = 0.1
export const CHANCE_DE_PULAR_UMA_VEZ = 0.15

function normalAcima(x: number): number {
  // 1 − Φ(x), aproximação de Abramowitz e Stegun 26.2.17 (erro < 7,5e−8).
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x >= 0 ? p : 1 - p
}

export type OpcoesDeAtivo = { riscoDeSaida?: number; chanceDePular?: number }

export function probabilidadeDeAtivo(entrada: EntradaComputeCycle, opcoes: OpcoesDeAtivo = {}): number {
  const h = opcoes.riscoDeSaida ?? RISCO_DE_SAIDA_POR_VISITA
  const q = opcoes.chanceDePular ?? CHANCE_DE_PULAR_UMA_VEZ
  if (entrada.history.length === 0) return 1 - h
  if (entrada.hasFutureAppointment) return 1
  const { personalCycleDays } = computeCycle(entrada)
  const { gaps, ritmoProvado } = intervalosDoRitmo(entrada.history, entrada.defaultCycleDays)
  let desvio: number
  if (ritmoProvado && gaps.length >= 3) {
    const recentes = gaps.slice(-8)
    const centro = mediana(recentes)
    desvio = 1.4826 * mediana(recentes.map((g) => Math.abs(g - centro))) * Math.sqrt(1 + 1 / recentes.length)
  } else {
    desvio = 0.3 * personalCycleDays
  }
  desvio = Math.max(desvio, 2, 0.08 * personalCycleDays)
  const ultima = entrada.history[entrada.history.length - 1]!.date
  const silencio = Temporal.PlainDate.compare(entrada.today, ultima) <= 0 ? 0 : ultima.until(entrada.today).total('days')
  const sobrevive =
    (1 - q) * normalAcima((silencio - personalCycleDays) / desvio) + q * normalAcima((silencio - 2 * personalCycleDays) / (desvio * Math.SQRT2))
  return ((1 - h) * sobrevive) / ((1 - h) * sobrevive + h)
}
