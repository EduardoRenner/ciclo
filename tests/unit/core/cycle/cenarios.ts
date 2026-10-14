import { Temporal } from '@js-temporal/polyfill'

import type { HistoricoParaBacktest } from '@/core/cycle/backtest'

/**
 * C-001 (MOT-002): cinco clientelas SINTÉTICAS com processo conhecido, semente fixa. Não é a clientela
 * real — é o banco de provas que diz se uma mudança no Motor melhora ou piora em cada tipo de cliente.
 */
export function mulberry32(semente: number) {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(r: () => number, media: number, desvio: number): number {
  const u = Math.max(r(), 1e-9)
  const v = r()
  return media + desvio * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

type Cenario = { nome: string; padrao: number; intervalo: (r: () => number, i: number) => number }

export const CENARIOS: Cenario[] = [
  { nome: 'regular (21±2)', padrao: 21, intervalo: (r) => normal(r, 21, 2) },
  { nome: 'deriva (21 → 35)', padrao: 21, intervalo: (r, i) => normal(r, 21 + 2 * i, 2) },
  { nome: 'pulo (21, às vezes 42)', padrao: 21, intervalo: (r) => (r() < 0.2 ? 42 : normal(r, 21, 2)) },
  { nome: 'errático (14–45)', padrao: 28, intervalo: (r) => 14 + r() * 31 },
  { nome: 'padrão errado (70±5, padrão 21)', padrao: 21, intervalo: (r) => normal(r, 70, 5) },
]

export function gerar(c: Cenario, clientes = 200, visitas = 8, semente = 105): HistoricoParaBacktest[] {
  const r = mulberry32(semente)
  return Array.from({ length: clientes }, () => {
    let dia = Temporal.PlainDate.from('2025-01-06').add({ days: Math.floor(r() * 30) })
    const datas = [dia]
    for (let i = 0; i < visitas - 1; i++) {
      dia = dia.add({ days: Math.max(1, Math.round(c.intervalo(r, i))) })
      datas.push(dia)
    }
    return { datas, padraoDoServico: c.padrao }
  })
}
