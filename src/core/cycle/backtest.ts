import { Temporal } from '@js-temporal/polyfill'

import { computeCycle, mediana } from './compute'
import { TOLERANCIA_DIAS } from './prestacao-de-contas'

/**
 * Backtest do Motor de Ciclo com ORIGEM MÓVEL (`docs/105-ciclo/C-001`).
 *
 * Para cada histórico de um cliente num serviço, e para cada ponto desse histórico, o previsor recebe
 * SÓ o passado (as visitas até ali) e diz quando a próxima acontece; o erro é a diferença, em dias,
 * entre a data prevista e a próxima visita real. É o método padrão de avaliar previsão sem vazar o
 * futuro para o palpite — validação embaralhada daria um número bonito e falso.
 *
 * Existe para que nenhuma mudança no Motor entre no ar sem antes vencer a versão atual e bases
 * simples na mesma amostra. `prestacaoDeContas` mede o acerto em produção, DEPOIS do fato; este mede
 * ANTES, e compara versões.
 */

/** Um previsor recebe o passado (datas em ordem) e o padrão do serviço, e devolve a data prevista da próxima visita. */
export type Previsor = (passado: readonly Temporal.PlainDate[], padraoDoServico: number) => Temporal.PlainDate

export type HistoricoParaBacktest = { datas: readonly Temporal.PlainDate[]; padraoDoServico: number }

export type FaixaDeHistorico = '1 visita' | '2 visitas' | '3+ visitas'

export type Metricas = {
  previsoes: number
  /** Mediana do |erro| em dias — a métrica principal: resistente ao cliente que sumiu meses. */
  erroMedianoDias: number
  erroMedioAbsolutoDias: number
  /** Média do erro com sinal: positivo = o previsor chuta tarde; negativo = cedo. */
  viesDias: number
  /** % de previsões que acertam a semana (±`TOLERANCIA_DIAS`), a mesma régua da prestação de contas. */
  acertoNaSemanaPct: number
}

export type ResultadoDoBacktest = { geral: Metricas; porFaixa: Partial<Record<FaixaDeHistorico, Metricas>> }

function faixa(visitasNoPassado: number): FaixaDeHistorico {
  return visitasNoPassado === 1 ? '1 visita' : visitasNoPassado === 2 ? '2 visitas' : '3+ visitas'
}

export function metricas(erros: readonly number[]): Metricas {
  if (erros.length === 0) return { previsoes: 0, erroMedianoDias: 0, erroMedioAbsolutoDias: 0, viesDias: 0, acertoNaSemanaPct: 0 }
  const absolutos = erros.map((e) => Math.abs(e))
  const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0)
  return {
    previsoes: erros.length,
    erroMedianoDias: mediana(absolutos),
    erroMedioAbsolutoDias: soma(absolutos) / erros.length,
    viesDias: soma(erros) / erros.length,
    acertoNaSemanaPct: (100 * absolutos.filter((e) => e <= TOLERANCIA_DIAS).length) / erros.length,
  }
}

export function backtest(historicos: readonly HistoricoParaBacktest[], previsor: Previsor): ResultadoDoBacktest {
  const todos: number[] = []
  const porFaixa = new Map<FaixaDeHistorico, number[]>()
  for (const h of historicos) {
    for (let k = 1; k < h.datas.length; k++) {
      // O previsor vê as visitas 0..k-1 — uma CÓPIA, para não poder ler a k-ésima nem mexer no array.
      const passado = h.datas.slice(0, k)
      const prevista = previsor(passado, h.padraoDoServico)
      const erro = prevista.since(h.datas[k]!).total('days')
      todos.push(erro)
      const f = faixa(k)
      porFaixa.set(f, [...(porFaixa.get(f) ?? []), erro])
    }
  }
  return {
    geral: metricas(todos),
    porFaixa: Object.fromEntries([...porFaixa].map(([f, erros]) => [f, metricas(erros)])),
  }
}

// ── Os previsores ────────────────────────────────────────────────────────────────────────────────

/** O Motor de produção, sem adaptação: o mesmo `computeCycle` que grava `cycle_predictions`. */
export const previsorDoMotor: Previsor = (passado, padrao) =>
  computeCycle({ history: passado.map((date) => ({ date })), defaultCycleDays: padrao, today: passado[passado.length - 1]! }).predictedDate

function intervalos(passado: readonly Temporal.PlainDate[]): number[] {
  const gaps: number[] = []
  for (let i = 1; i < passado.length; i++) gaps.push(passado[i]!.since(passado[i - 1]!).total('days'))
  return gaps
}

/** Base 1 — a régua fixa do setor: todo mundo volta no padrão do serviço. */
export const previsorPadraoDoServico: Previsor = (passado, padrao) => passado[passado.length - 1]!.add({ days: padrao })

/** Base 2 — o último intervalo se repete (sem intervalo, o padrão). */
export const previsorUltimoIntervalo: Previsor = (passado, padrao) => {
  const g = intervalos(passado)
  return passado[passado.length - 1]!.add({ days: g.length ? g[g.length - 1]! : padrao })
}

/** Base 3 — a média de todos os intervalos (sem intervalo, o padrão). */
export const previsorMedia: Previsor = (passado, padrao) => {
  const g = intervalos(passado)
  return passado[passado.length - 1]!.add({ days: Math.round(g.length ? g.reduce((a, b) => a + b, 0) / g.length : padrao) })
}

/** Base 4 — a mediana de todos os intervalos, sem filtro nem limite (sem intervalo, o padrão). */
export const previsorMedianaPura: Previsor = (passado, padrao) => {
  const g = intervalos(passado)
  return passado[passado.length - 1]!.add({ days: Math.round(g.length ? mediana(g) : padrao) })
}

export const PREVISORES_DE_BASE = {
  'padrão do serviço': previsorPadraoDoServico,
  'último intervalo': previsorUltimoIntervalo,
  média: previsorMedia,
  'mediana pura': previsorMedianaPura,
} as const
