import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { mediana } from '@/core/cycle/compute'
import { faixaDaPrevisao, type OpcoesDaFaixa } from '@/core/cycle/incerteza'
import { TOLERANCIA_DIAS } from '@/core/cycle/prestacao-de-contas'

import { CENARIOS, gerar } from './cenarios'

/**
 * C-008 (A-09): a faixa do próprio cliente contra a régua fixa de ±7 dias, nos cinco cenários.
 * Cobertura = % das voltas reais dentro da faixa (alvo 80%). Largura = folga em dias (menor é mais
 * útil: o lembrete pode sair mais cedo). Origem móvel: só o passado entra em cada previsão.
 */
type Linha = { cobertura: number; folgaMediana: number; previsoes: number }

function medir(nome: string, faixa: 'fixa' | OpcoesDaFaixa, apenasComRitmo: boolean): Linha {
  const c = CENARIOS.find((x) => x.nome === nome)!
  let dentro = 0
  let total = 0
  const folgas: number[] = []
  for (const h of gerar(c)) {
    for (let k = apenasComRitmo ? 4 : 1; k < h.datas.length; k++) {
      const passado = h.datas.slice(0, k).map((date) => ({ date }))
      const f = faixaDaPrevisao({ history: passado, defaultCycleDays: h.padraoDoServico, today: h.datas[k - 1]! }, faixa === 'fixa' ? {} : faixa)
      const folga = faixa === 'fixa' ? TOLERANCIA_DIAS : f.folgaDias
      const erro = Math.abs(h.datas[k]!.since(f.prevista).total('days'))
      if (erro <= folga) dentro++
      folgas.push(folga)
      total++
    }
  }
  return { cobertura: Math.round((100 * dentro) / total), folgaMediana: mediana(folgas), previsoes: total }
}

describe('placar da faixa de incerteza (C-008)', () => {
  const linhas = CENARIOS.map((c) => ({
    cenario: c.nome,
    'fixa ±7: cobertura %': medir(c.nome, 'fixa', true).cobertura,
    'própria: cobertura %': medir(c.nome, {}, true).cobertura,
    'própria: folga (d)': medir(c.nome, {}, true).folgaMediana,
    'sem ritmo (1–3 visitas) cobertura %': medir(c.nome, {}, false).cobertura,
  }))

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas).toHaveLength(5)
  })

  it('a faixa própria fica perto da cobertura alvo (77–95%, o mínimo medido no C-008) em TODOS os cenários com ritmo provado; a fixa vai de 44% a 100%', () => {
    for (const l of linhas) {
      expect(l['própria: cobertura %'], l.cenario).toBeGreaterThanOrEqual(77)
      expect(l['própria: cobertura %'], l.cenario).toBeLessThanOrEqual(95)
    }
  })

  it('quem é regular ganha uma faixa mais estreita que a semana; quem é errático, mais larga', () => {
    const regular = linhas.find((l) => l.cenario.startsWith('regular'))!
    const erratico = linhas.find((l) => l.cenario.startsWith('errático'))!
    expect(regular['própria: folga (d)']).toBeLessThanOrEqual(3)
    expect(erratico['própria: folga (d)']).toBeGreaterThan(TOLERANCIA_DIAS)
  })
})

describe('faixa de um cliente (C-008)', () => {
  const d = (s: string) => Temporal.PlainDate.from(s)
  const historico = (gaps: number[]) => {
    let dia = d('2026-01-05')
    const h = [{ date: dia }]
    for (const g of gaps) h.push({ date: (dia = dia.add({ days: g })) })
    return h
  }

  it('cliente-relógio: faixa estreita e medida', () => {
    const f = faixaDaPrevisao({ history: historico([21, 20, 22, 21, 21]), defaultCycleDays: 21, today: d('2026-04-01') })
    expect(f.origem).toBe('medida')
    expect(f.folgaDias).toBe(2)
  })

  it('cliente que varia: faixa larga, não parece atraso quando é só o ritmo dele', () => {
    const f = faixaDaPrevisao({ history: historico([15, 40, 22, 35, 18, 44]), defaultCycleDays: 28, today: d('2026-08-01') })
    expect(f.origem).toBe('medida')
    expect(f.folgaDias).toBeGreaterThan(TOLERANCIA_DIAS)
  })

  it('com menos de 3 intervalos a faixa diz que veio do padrão', () => {
    const f = faixaDaPrevisao({ history: historico([21]), defaultCycleDays: 21, today: d('2026-02-01') })
    expect(f.origem).toBe('padrao')
    expect(f.tarde.since(f.prevista).total('days')).toBe(f.folgaDias)
  })
})
