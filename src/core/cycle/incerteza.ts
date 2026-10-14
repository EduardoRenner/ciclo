import { Temporal } from '@js-temporal/polyfill'

import { computeCycle, intervalosDoRitmo, mediana, type EntradaComputeCycle } from './compute'

/**
 * A faixa de incerteza da previsão (`docs/105-ciclo/C-008`, aposta A-09: regularidade).
 *
 * O Motor diz UMA data, e todo mundo era julgado pela mesma régua de ±7 dias (`TOLERANCIA_DIAS`).
 * Para quem volta como relógio (21 ± 2), uma semana de folga é larga demais: o lembrete chega quando
 * a pessoa já sumiu. Para quem volta entre 14 e 45 dias, é estreita demais: metade das voltas
 * normais cai fora e parece atraso. A faixa sai da dispersão do PRÓPRIO cliente — o Motor passa a
 * dizer o quanto não sabe.
 *
 * Método, sem ML e explicável: desvio absoluto mediano (MAD) dos intervalos que o Motor usou,
 * convertido em desvio-padrão robusto (× 1,4826), inflado pela incerteza de estimar com poucos
 * intervalos (√(1 + 1/n)), vezes z; mais a TENDÊNCIA (quanto os 2 últimos intervalos se afastam da
 * mediana), porque quem está mudando de ritmo erra mais do que a dispersão sozinha diz. Só o MAD
 * cobria 52% das voltas de quem deriva; com a tendência, 80% (placar do C-008). O z é o de 90%
 * nominal porque com 3–7 intervalos a cobertura observada fica ~10 pontos abaixo da nominal: o alvo
 * medido é ~80%. Com menos de 3 intervalos não há dispersão medida: a folga é uma fração do ciclo,
 * e a faixa diz que veio do padrão.
 */

export type FaixaDaPrevisao = {
  /** Data mais cedo em que a volta ainda é "normal" para este cliente. */
  cedo: Temporal.PlainDate
  prevista: Temporal.PlainDate
  /** Passou disto sem voltar: aí é atraso de verdade, não ruído do ritmo dele. */
  tarde: Temporal.PlainDate
  folgaDias: number
  /** 'medida' = dispersão do próprio cliente (3+ intervalos); 'padrao' = fração do ciclo. */
  origem: 'medida' | 'padrao'
}

/** z de 90% bicaudal; a cobertura OBSERVADA nos cinco cenários fica entre 77% e 90% (C-008). */
export const Z_DA_FAIXA = 1.645
export const FOLGA_MINIMA_DIAS = 2
/** Sem ritmo provado, a folga é esta fração do ciclo pessoal (medido no C-008, ver o placar). */
export const FRACAO_SEM_RITMO = 0.3

export type OpcoesDaFaixa = { z?: number; fracaoSemRitmo?: number; folgaMinima?: number }

export function faixaDaPrevisao(entrada: EntradaComputeCycle, opcoes: OpcoesDaFaixa = {}): FaixaDaPrevisao {
  const z = opcoes.z ?? Z_DA_FAIXA
  const fracao = opcoes.fracaoSemRitmo ?? FRACAO_SEM_RITMO
  const minima = opcoes.folgaMinima ?? FOLGA_MINIMA_DIAS
  const { personalCycleDays, predictedDate } = computeCycle(entrada)
  const { gaps, ritmoProvado } = intervalosDoRitmo(entrada.history, entrada.defaultCycleDays)

  let folga: number
  let origem: FaixaDaPrevisao['origem']
  if (ritmoProvado && gaps.length >= 3) {
    const recentes = gaps.slice(-8)
    const centro = mediana(recentes)
    const mad = mediana(recentes.map((g) => Math.abs(g - centro)))
    const desvio = 1.4826 * mad * Math.sqrt(1 + 1 / recentes.length)
    const tendencia = Math.abs(mediana(gaps.slice(-2)) - centro)
    folga = Math.max(minima, Math.round(z * desvio + tendencia))
    origem = 'medida'
  } else {
    folga = Math.max(minima, Math.round(fracao * personalCycleDays))
    origem = 'padrao'
  }
  return { cedo: predictedDate.subtract({ days: folga }), prevista: predictedDate, tarde: predictedDate.add({ days: folga }), folgaDias: folga, origem }
}
