import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { PREVISORES_DE_BASE, backtest, previsorDoMotor, type HistoricoParaBacktest, type Previsor, type ResultadoDoBacktest } from '@/core/cycle/backtest'

/**
 * C-001 (MOT-002): cinco clientelas SINTÉTICAS com processo conhecido, semente fixa. Não é a clientela
 * real — é o banco de provas que diz se uma mudança no Motor melhora ou piora em cada tipo de cliente.
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

export function placar(previsores: Record<string, Previsor>): Record<string, Record<string, ResultadoDoBacktest>> {
  return Object.fromEntries(CENARIOS.map((c) => [c.nome, Object.fromEntries(Object.entries(previsores).map(([n, p]) => [n, backtest(gerar(c), p)]))]))
}

describe('o Motor nos cinco cenários (C-001)', () => {
  const tabela = placar({ 'Motor v-atual': previsorDoMotor, ...PREVISORES_DE_BASE })

  it('imprime o placar (erro mediano em dias · acerto na semana) para o registro do ciclo', () => {
    const linhas = Object.entries(tabela).flatMap(([cenario, porPrevisor]) =>
      Object.entries(porPrevisor).map(([previsor, r]) => ({
        cenario,
        previsor,
        'erro mediano (3+)': r.porFaixa['3+ visitas']?.erroMedianoDias,
        'acerto ±7 (3+) %': Math.round(r.porFaixa['3+ visitas']?.acertoNaSemanaPct ?? 0),
        'erro mediano (geral)': r.geral.erroMedianoDias,
        'viés (geral)': Math.round(r.geral.viesDias * 10) / 10,
      })),
    )
    console.table(linhas)
    expect(linhas.length).toBe(CENARIOS.length * 5)
  })

  it('o Motor ganha da régua fixa do serviço onde o cliente tem ritmo próprio (regular com deriva)', () => {
    const deriva = tabela['deriva (21 → 35)']!
    expect(deriva['Motor v-atual']!.porFaixa['3+ visitas']!.erroMedianoDias).toBeLessThan(deriva['padrão do serviço']!.porFaixa['3+ visitas']!.erroMedianoDias)
  })
})

/**
 * Guarda MOT-003: a versão do Motor no ar não pode piorar NENHUM cenário em relação à anterior.
 * O piso é a versão anterior medida neste arquivo (v1 em C-001; v3 em C-006, `docs/105-ciclo/`). Mudou o Motor? Rode o placar, e só baixe um número desta tabela com
 * melhora medida — nunca suba.
 */
const PISO_ERRO_MEDIANO_3MAIS: Record<string, number> = {
  'regular (21±2)': 1,
  'deriva (21 → 35)': 4,
  'pulo (21, às vezes 42)': 3,
  'errático (14–45)': 8,
  'padrão errado (70±5, padrão 21)': 5,
}
const PISO_ACERTO_3MAIS_PCT: Record<string, number> = {
  'regular (21±2)': 100,
  'deriva (21 → 35)': 92,
  'pulo (21, às vezes 42)': 74,
  'errático (14–45)': 47,
  'padrão errado (70±5, padrão 21)': 66,
}

describe('nenhuma versão do Motor piora um cenário (C-001, MOT-003)', () => {
  const atual = placar({ Motor: previsorDoMotor })
  it.each(CENARIOS.map((c) => c.nome))('%s: erro mediano e acerto na semana iguais ou melhores que a versão anterior', (nome) => {
    const r = atual[nome]!['Motor']!.porFaixa['3+ visitas']!
    expect(r.erroMedianoDias).toBeLessThanOrEqual(PISO_ERRO_MEDIANO_3MAIS[nome]!)
    expect(Math.round(r.acertoNaSemanaPct)).toBeGreaterThanOrEqual(PISO_ACERTO_3MAIS_PCT[nome]!)
  })

  it('v2: o cliente de ritmo longo num serviço de padrão errado deixa de ser previsto pelo padrão', () => {
    const r = atual['padrão errado (70±5, padrão 21)']!['Motor']!.porFaixa['3+ visitas']!
    expect(r.erroMedianoDias).toBeLessThan(10)
    expect(r.acertoNaSemanaPct).toBeGreaterThan(50)
  })
})
