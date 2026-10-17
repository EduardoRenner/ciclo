import { describe, expect, it } from 'vitest'

import { computeCycle, mediana } from '@/core/cycle/compute'
import { ALFA_DO_ALERTA, estadoPelaFaixa, faixaDaPrevisao } from '@/core/cycle/incerteza'

import { CENARIOS, gerar, mulberry32 } from './cenarios'

/**
 * C-009: o placar de lembretes antes de o estado pela faixa (v4) entrar no ar.
 *
 * Clientela sintética dos cinco cenários com SUMIÇO: 25% dos clientes param de vir depois de uma
 * visita sorteada (a 4ª em diante). Para cada previsão (origem móvel, 3+ intervalos), o "alerta" é o
 * primeiro dia em que o cliente entra em `late` — é aí que ele aparece na fila de recuperar.
 * - lembrete desnecessário: o alerta saiu ANTES de uma volta que ia acontecer sozinha;
 * - dias até notar: para quem sumiu de vez, quantos dias depois da última visita o alerta sai.
 * As duas medidas puxam em sentidos opostos; o placar mostra o preço de cada regra.
 */
const SUMICO = 0.25

/** Antes da data prevista nenhuma regra marca `late`; começar 5 dias antes dela poupa tempo sem mudar o resultado. */
function primeiroDiaLate(desde: number, estadoEm: (dias: number) => string): number {
  for (let d = Math.max(1, desde - 5); d < 400; d++) if (estadoEm(d) === 'late') return d
  return 400
}

function medir(nome: string, regra: 'fixa' | 'faixa', alfa = ALFA_DO_ALERTA) {
  const c = CENARIOS.find((x) => x.nome === nome)!
  const r = mulberry32(9)
  let desnecessarios = 0
  let voltas = 0
  const ateNotar: number[] = []
  for (const h of gerar(c)) {
    const corte = r() < SUMICO ? 4 + Math.floor(r() * (h.datas.length - 4)) : h.datas.length
    const datas = h.datas.slice(0, corte)
    for (let k = 4; k <= datas.length; k++) {
      const passado = datas.slice(0, k).map((date) => ({ date }))
      const ultima = datas[k - 1]!
      const entrada = (hoje: typeof ultima) => ({ history: passado, defaultCycleDays: h.padraoDoServico, today: hoje })
      const faixa = faixaDaPrevisao(entrada(ultima))
      const alerta = primeiroDiaLate(faixa.prevista.since(ultima).total('days'), (d) => {
        const hoje = ultima.add({ days: d })
        return regra === 'fixa' ? computeCycle(entrada(hoje)).state : estadoPelaFaixa(faixa, hoje, false, alfa)
      })
      if (k < datas.length) {
        voltas++
        if (alerta < datas[k]!.since(ultima).total('days')) desnecessarios++
      } else if (corte < h.datas.length) {
        ateNotar.push(alerta)
      }
    }
  }
  return { desnecessariosPct: Math.round((100 * desnecessarios) / voltas), diasAteNotar: mediana(ateNotar), sumidos: ateNotar.length }
}

describe('placar de lembretes: régua fixa × faixa do cliente (C-009)', () => {
  const linhas = CENARIOS.map((c) => {
    const f = medir(c.nome, 'fixa')
    const p = medir(c.nome, 'faixa')
    return {
      cenario: c.nome,
      'fixa: desnecessário %': f.desnecessariosPct,
      'faixa: desnecessário %': p.desnecessariosPct,
      'fixa: dias até notar': f.diasAteNotar,
      'faixa: dias até notar': p.diasAteNotar,
      sumidos: p.sumidos,
    }
  })

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas.every((l) => l.sumidos > 0)).toBe(true)
  })

  it('controle do arnês: com alfa 0 a faixa reproduz EXATAMENTE a régua de hoje', () => {
    for (const c of CENARIOS) expect(medir(c.nome, 'faixa', 0), c.nome).toEqual(medir(c.nome, 'fixa'))
    // ~4 s sozinho; com a suíte inteira em paralelo passa dos 5 s padrão.
  }, 60_000)

  /** Pisos medidos no C-009 (alfa 0,5). Mudou a faixa ou o alfa? Só baixe um número com melhora medida. */
  const TETO_DESNECESSARIO_PCT: Record<string, number> = {
    'regular (21±2)': 6,
    'deriva (21 → 35)': 34,
    'pulo (21, às vezes 42)': 19,
    'errático (14–45)': 20,
    'padrão errado (70±5, padrão 21)': 16,
  }

  it.each(CENARIOS.map((c) => c.nome))('%s: menos lembretes desnecessários que a régua de hoje, no teto medido; notar quem sumiu atrasa no máximo 8 dias', (nome) => {
    const l = linhas.find((x) => x.cenario === nome)!
    expect(l['faixa: desnecessário %']).toBeLessThan(l['fixa: desnecessário %'])
    expect(l['faixa: desnecessário %']).toBeLessThanOrEqual(TETO_DESNECESSARIO_PCT[nome]!)
    expect(l['faixa: dias até notar'] - l['fixa: dias até notar']).toBeLessThanOrEqual(8)
  })
})

