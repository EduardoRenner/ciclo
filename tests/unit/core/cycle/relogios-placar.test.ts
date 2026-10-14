import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { mediana } from '@/core/cycle/compute'
import { preverPorRelogios, type Visita } from '@/core/cycle/relogios'

/**
 * C-002: cinco perfis SINTÉTICOS de motorista, semente fixa. A verdade de cada manutenção é o dia em
 * que vence "10.000 km ou 365 dias, o que ocorrer primeiro"; o dono chega 0–10 dias depois. O placar
 * compara três jeitos de lembrar a PRÓXIMA manutenção a partir de cada visita.
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

const REGRA = { dias: 365, uso: 10_000, tempoPeloRitmo: false } as const
const REFERENCIA_BR = 13_000 / 365 // ~36 km/dia (KBB/Sindipeças, docs/105-ciclo/C-002/01-pesquisa.md)

const PERFIS = [
  { nome: 'pouco uso (6 mil/ano)', kmAno: 6_000 },
  { nome: 'médio (13 mil/ano)', kmAno: 13_000 },
  { nome: 'muito uso (25 mil/ano)', kmAno: 25_000 },
  { nome: 'aplicativo (50 mil/ano)', kmAno: 50_000 },
  { nome: 'irregular (8–30 mil/ano)', kmAno: -1 },
]

type Caso = { visitas: Visita[]; vencimentos: Temporal.PlainDate[] }

function gerar(kmAno: number, r: () => number): Caso {
  const ano = kmAno > 0 ? kmAno * (0.85 + r() * 0.3) : 8_000 + r() * 22_000
  let dia = Temporal.PlainDate.from('2024-01-08').add({ days: Math.floor(r() * 60) })
  let km = 20_000 + Math.floor(r() * 40_000)
  const visitas: Visita[] = [{ date: dia, uso: km }]
  const vencimentos: Temporal.PlainDate[] = []
  for (let i = 0; i < 6; i++) {
    const porDia = (ano / 365) * (0.8 + r() * 0.4)
    const venceEm = Math.min(Math.ceil(REGRA.uso / porDia), REGRA.dias)
    vencimentos.push(dia.add({ days: venceEm }))
    const atraso = Math.floor(r() * 11)
    dia = dia.add({ days: venceEm + atraso })
    km = Math.round(km + porDia * (venceEm + atraso))
    visitas.push({ date: dia, uso: km })
  }
  return { visitas, vencimentos }
}

type Lembrador = (passado: Visita[]) => Temporal.PlainDate

const LEMBRADORES: Record<string, Lembrador> = {
  'só meses (StarkOS hoje)': (p) => p[p.length - 1]!.date.add({ days: 365 }),
  'o que vencer primeiro, ritmo médio do Brasil': (p) => preverPorRelogios([p[p.length - 1]!], REGRA, REFERENCIA_BR).data,
  'o que vencer primeiro, ritmo do carro': (p) => preverPorRelogios(p, REGRA, REFERENCIA_BR).data,
}

function placar() {
  const linhas: { perfil: string; lembrador: string; erroMediano: number; atrasoMediano: number; lembraTardePct: number }[] = []
  for (const perfil of PERFIS) {
    for (const [nome, lembrar] of Object.entries(LEMBRADORES)) {
      const r = mulberry32(2002)
      const casos = Array.from({ length: 300 }, () => gerar(perfil.kmAno, r))
      const erros: number[] = []
      // a partir da 2ª visita (há leitura anterior para medir ritmo); prevê o vencimento seguinte
      for (const c of casos) for (let k = 2; k < c.visitas.length; k++) erros.push(lembrar(c.visitas.slice(0, k)).since(c.vencimentos[k - 1]!).total('days'))
      linhas.push({
        perfil: perfil.nome,
        lembrador: nome,
        erroMediano: mediana(erros.map(Math.abs)),
        atrasoMediano: mediana(erros),
        lembraTardePct: Math.round((100 * erros.filter((e) => e > 7).length) / erros.length),
      })
    }
  }
  return linhas
}

describe('o que vencer primeiro, com o ritmo de cada carro (C-002)', () => {
  const linhas = placar()

  it('imprime o placar (erro mediano · atraso mediano · % que lembra mais de 7 dias tarde)', () => {
    console.table(linhas)
    expect(linhas.length).toBe(PERFIS.length * 3)
  })

  it.each(PERFIS.map((p) => p.nome))('%s: o ritmo do carro erra no máximo 30 dias na mediana e nunca é pior que "só meses"', (perfil) => {
    const doPerfil = linhas.filter((l) => l.perfil === perfil)
    const carro = doPerfil.find((l) => l.lembrador === 'o que vencer primeiro, ritmo do carro')!
    const meses = doPerfil.find((l) => l.lembrador === 'só meses (StarkOS hoje)')!
    expect(carro.erroMediano).toBeLessThanOrEqual(30)
    expect(carro.erroMediano).toBeLessThanOrEqual(meses.erroMediano)
  })
})

/**
 * C-038: o carro que MUDA de uso. Os perfis de cima têm o mesmo ritmo a vida toda; aqui o uso troca no
 * 3º intervalo (virou carro de aplicativo; parou de rodar) ou tem UM ano fora da curva (uma viagem longa).
 * O comparador é o jeito antigo — a mediana do histórico inteiro — refeito aqui fora do módulo.
 */
const PERFIS_QUE_MUDAM: { nome: string; mudanca: boolean; kmAno: (i: number, base: number, r: () => number) => number }[] = [
  { nome: 'estável ±20%', mudanca: false, kmAno: (_i, b, r) => b * (0.8 + r() * 0.4) },
  { nome: 'virou aplicativo no 3º (13 mil → 45 mil)', mudanca: true, kmAno: (i, _b, r) => (i < 3 ? 13_000 : 45_000) * (0.85 + r() * 0.3) },
  { nome: 'parou de rodar no 3º (25 mil → 7 mil)', mudanca: true, kmAno: (i, _b, r) => (i < 3 ? 25_000 : 7_000) * (0.85 + r() * 0.3) },
  { nome: 'ruidoso ±50%', mudanca: false, kmAno: (_i, b, r) => b * (0.5 + r()) },
  { nome: 'um ano atípico (viagem, 3×)', mudanca: false, kmAno: (i, b, r) => (i === 2 ? 3 * b : b) * (0.9 + r() * 0.2) },
]

function gerarQueMuda(perfil: (typeof PERFIS_QUE_MUDAM)[number], r: () => number): Caso {
  const base = 8_000 + r() * 30_000
  let dia = Temporal.PlainDate.from('2024-01-08')
  let km = 30_000
  const visitas: Visita[] = [{ date: dia, uso: km }]
  const vencimentos: Temporal.PlainDate[] = []
  for (let i = 0; i < 7; i++) {
    const porDia = perfil.kmAno(i, base, r) / 365
    const venceEm = Math.min(Math.ceil(REGRA.uso / porDia), REGRA.dias)
    vencimentos.push(dia.add({ days: venceEm }))
    const atraso = Math.floor(r() * 11)
    dia = dia.add({ days: venceEm + atraso })
    km = Math.round(km + porDia * (venceEm + atraso))
    visitas.push({ date: dia, uso: km })
  }
  return { visitas, vencimentos }
}

function medianaDoHistoricoInteiro(p: Visita[]): Temporal.PlainDate {
  const taxas = p.slice(1).map((v, i) => (v.uso! - p[i]!.uso!) / v.date.since(p[i]!.date).total('days'))
  const dias = Math.min(Math.round(REGRA.uso / mediana(taxas)), REGRA.dias)
  return p[p.length - 1]!.date.add({ days: dias })
}

function erroMedianoQueMuda(perfil: (typeof PERFIS_QUE_MUDAM)[number], lembrar: Lembrador) {
  const r = mulberry32(3803)
  const erros: number[] = []
  for (let c = 0; c < 400; c++) {
    const caso = gerarQueMuda(perfil, r)
    for (let k = 2; k < caso.visitas.length; k++) erros.push(lembrar(caso.visitas.slice(0, k)).since(caso.vencimentos[k - 1]!).total('days'))
  }
  return mediana(erros.map(Math.abs))
}

describe('o carro que muda de uso: só as taxas recentes (C-038)', () => {
  const linhas = PERFIS_QUE_MUDAM.map((p) => ({
    perfil: p.nome,
    mudanca: p.mudanca,
    'histórico inteiro (antes)': erroMedianoQueMuda(p, medianaDoHistoricoInteiro),
    'as 3 últimas (agora)': erroMedianoQueMuda(p, (passado) => preverPorRelogios(passado, REGRA, REFERENCIA_BR).data),
  }))

  it('imprime o placar (erro mediano em dias)', () => {
    console.table(linhas)
    expect(linhas).toHaveLength(PERFIS_QUE_MUDAM.length)
  })

  it.each(PERFIS_QUE_MUDAM.filter((p) => p.mudanca).map((p) => p.nome))('%s: percebe a troca — erra no máximo 30 dias e menos da metade do jeito antigo', (nome) => {
    const l = linhas.find((x) => x.perfil === nome)!
    expect(l['as 3 últimas (agora)']).toBeLessThanOrEqual(30)
    expect(l['as 3 últimas (agora)']).toBeLessThan(l['histórico inteiro (antes)'] / 2)
  })

  it.each(PERFIS_QUE_MUDAM.filter((p) => !p.mudanca).map((p) => p.nome))('%s: não paga pela janela — no máximo 2 dias pior que o histórico inteiro', (nome) => {
    const l = linhas.find((x) => x.perfil === nome)!
    expect(l['as 3 últimas (agora)']).toBeLessThanOrEqual(l['histórico inteiro (antes)'] + 2)
  })
})
