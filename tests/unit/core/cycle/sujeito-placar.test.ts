import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { backtest, previsorDoMotor } from '@/core/cycle/backtest'
import { computeCycle } from '@/core/cycle/compute'
import { agruparPorSujeito, type VisitaComSujeito } from '@/core/cycle/sujeito'

/**
 * C-003: um cliente, dois sujeitos (2 cães no banho quinzenal, ou 2 carros na revisão), defasados.
 * Hoje o ciclo é por (cliente, serviço): as duas séries viram uma. O placar mede o erro do Motor
 * com a série misturada × separada por sujeito. Sintético, semente fixa.
 */
function mulberry32(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tutorComDoisAnimais(r: () => number): VisitaComSujeito[] {
  const visitas: VisitaComSujeito[] = []
  for (const [sujeito, defasagem] of [['rex', 0], ['mel', 5 + Math.floor(r() * 5)]] as const) {
    let dia = Temporal.PlainDate.from('2025-02-03').add({ days: defasagem })
    for (let i = 0; i < 8; i++) {
      visitas.push({ date: dia, sujeito })
      dia = dia.add({ days: 14 + Math.round((r() - 0.5) * 4) })
    }
  }
  return visitas.sort((a, b) => Temporal.PlainDate.compare(a.date, b.date))
}

describe('quem volta não é sempre o cliente (C-003)', () => {
  const r = mulberry32(3003)
  const tutores = Array.from({ length: 200 }, () => tutorComDoisAnimais(r))
  const PADRAO = 15

  const misturado = backtest(tutores.map((v) => ({ datas: v.map((x) => x.date), padraoDoServico: PADRAO })), previsorDoMotor)
  const porSujeito = backtest(
    tutores.flatMap((v) => [...agruparPorSujeito(v).values()].map((datas) => ({ datas, padraoDoServico: PADRAO }))),
    previsorDoMotor,
  )

  it('imprime o placar', () => {
    console.table({
      'série única (hoje)': { 'erro mediano 3+ (d)': misturado.porFaixa['3+ visitas']?.erroMedianoDias, 'acerto ±7 3+ (%)': Math.round(misturado.porFaixa['3+ visitas']?.acertoNaSemanaPct ?? 0), 'viés (d)': Math.round(misturado.geral.viesDias * 10) / 10 },
      'por sujeito': { 'erro mediano 3+ (d)': porSujeito.porFaixa['3+ visitas']?.erroMedianoDias, 'acerto ±7 3+ (%)': Math.round(porSujeito.porFaixa['3+ visitas']?.acertoNaSemanaPct ?? 0), 'viés (d)': Math.round(porSujeito.geral.viesDias * 10) / 10 },
    })
    expect(misturado.geral.previsoes).toBeGreaterThan(0)
  })

  it('separar por sujeito reduz o erro: cada animal tem o próprio relógio', () => {
    expect(porSujeito.porFaixa['3+ visitas']!.erroMedianoDias).toBeLessThan(misturado.porFaixa['3+ visitas']!.erroMedianoDias)
  })
})

/**
 * O dano de verdade não é a data da próxima visita de "alguém" (essa a série misturada acerta: o
 * outro animal vem uma semana depois). É a PERDA: quando um dos animais para de vir (mudou de pet
 * shop, morreu), a série misturada continua recebendo visitas do outro e nunca diz que alguém sumiu.
 */
function tutorQuePerdeUm(r: () => number): { visitas: VisitaComSujeito[]; ultimaDaMel: Temporal.PlainDate } {
  const visitas: VisitaComSujeito[] = []
  let ultimaDaMel = Temporal.PlainDate.from('2025-02-03')
  for (const [sujeito, defasagem, quantas] of [['rex', 0, 12], ['mel', 5 + Math.floor(r() * 5), 5]] as const) {
    let dia = Temporal.PlainDate.from('2025-02-03').add({ days: defasagem })
    for (let i = 0; i < quantas; i++) {
      visitas.push({ date: dia, sujeito })
      if (sujeito === 'mel') ultimaDaMel = dia
      dia = dia.add({ days: 14 + Math.round((r() - 0.5) * 4) })
    }
  }
  return { visitas: visitas.sort((a, b) => Temporal.PlainDate.compare(a.date, b.date)), ultimaDaMel }
}

describe('quando um dos sujeitos some (C-003)', () => {
  const r = mulberry32(3004)
  const casos = Array.from({ length: 200 }, () => tutorQuePerdeUm(r))
  // 45 dias depois da última visita da Mel: ela já devia ter voltado 2 vezes.
  const estados = casos.map(({ visitas, ultimaDaMel }) => {
    const hoje = ultimaDaMel.add({ days: 45 })
    const ate = visitas.filter((v) => Temporal.PlainDate.compare(v.date, hoje) <= 0)
    const misturado = computeCycle({ history: ate.map((v) => ({ date: v.date })), defaultCycleDays: 15, today: hoje }).state
    const mel = agruparPorSujeito(ate).get('mel')!
    const porSujeito = computeCycle({ history: mel.map((date) => ({ date })), defaultCycleDays: 15, today: hoje }).state
    return { misturado, porSujeito }
  })
  const sumiu = (e: string) => e === 'at_risk' || e === 'lost'
  const pctMisturado = Math.round((100 * estados.filter((e) => sumiu(e.misturado)).length) / estados.length)
  const pctPorSujeito = Math.round((100 * estados.filter((e) => sumiu(e.porSujeito)).length) / estados.length)

  it('imprime: % dos tutores em que a perda de um animal aparece (em risco ou perdido) 45 dias depois', () => {
    console.table({ 'série única (hoje)': { 'perda vista (%)': pctMisturado }, 'por sujeito': { 'perda vista (%)': pctPorSujeito } })
    expect(estados.length).toBe(200)
  })

  it('por sujeito, a perda aparece; na série única, ela fica invisível', () => {
    expect(pctPorSujeito).toBeGreaterThanOrEqual(95)
    expect(pctMisturado).toBeLessThan(pctPorSujeito)
  })
})
