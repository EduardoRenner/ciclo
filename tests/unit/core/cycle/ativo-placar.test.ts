import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { probabilidadeDeAtivo, type OpcoesDeAtivo } from '@/core/cycle/ativo'
import { computeCycle, mediana } from '@/core/cycle/compute'
import { PROBABILIDADE_POR_ESTADO } from '@/core/cycle/valor-em-risco'

import { CENARIOS, gerar, mulberry32 } from './cenarios'

/**
 * C-014: quem está atrasado ainda volta? Fotografia em um dia sorteado de cada cliente (25% somem de
 * vez depois de uma visita sorteada). Só entram os ATRASADOS no dia da foto (late, at_risk, lost): é a
 * fila de recuperar. Rótulo: houve visita depois da foto. Mede-se a ORDEM (AUC: chance de um que volta
 * ficar acima de um que sumiu) e o erro quadrático (Brier) da tabela de hoje × P(ativo).
 */
type Foto = { tabela: number; ativo: number; voltou: boolean; visitas: number }

function fotos(nome: string, opcoes: OpcoesDeAtivo = {}): Foto[] {
  const c = CENARIOS.find((x) => x.nome === nome)!
  const r = mulberry32(14)
  const out: Foto[] = []
  for (const h of gerar(c, 1500)) {
    const sumiu = r() < 0.25
    const datas = sumiu ? h.datas.slice(0, 4 + Math.floor(r() * (h.datas.length - 4))) : h.datas
    const k = 3 + Math.floor(r() * (datas.length - 2))
    const passado = datas.slice(0, Math.min(k, datas.length))
    const ultima = passado[passado.length - 1]!
    let hoje: Temporal.PlainDate
    let voltou: boolean
    if (k < datas.length) {
      hoje = ultima.add({ days: Math.floor(r() * ultima.until(datas[k]!).total('days')) })
      voltou = true
    } else if (sumiu) {
      // Silêncio medido no ritmo DO CLIENTE (no padrão do serviço, quem tem ritmo longo nem aparece atrasado).
      const ritmo = mediana(passado.slice(1).map((d, i) => passado[i]!.until(d).total('days')))
      hoje = ultima.add({ days: Math.round((0.5 + 2.5 * r()) * ritmo) })
      voltou = false
    } else {
      continue
    }
    const entrada = { history: passado.map((date) => ({ date })), defaultCycleDays: h.padraoDoServico, today: hoje }
    const estado = computeCycle(entrada).state
    if (estado === 'on_track' || estado === 'due') continue
    out.push({ tabela: PROBABILIDADE_POR_ESTADO[estado], ativo: probabilidadeDeAtivo(entrada, opcoes), voltou, visitas: passado.length })
  }
  return out
}

/** AUC por Mann–Whitney, empates contam meio. */
function auc(xs: Foto[], nota: (f: Foto) => number): number {
  const pos = xs.filter((f) => f.voltou).map(nota)
  const neg = xs.filter((f) => !f.voltou).map(nota)
  let s = 0
  for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0
  return pos.length && neg.length ? s / (pos.length * neg.length) : NaN
}
const brier = (xs: Foto[], nota: (f: Foto) => number) => xs.reduce((a, f) => a + (nota(f) - (f.voltou ? 1 : 0)) ** 2, 0) / xs.length
const r2 = (x: number) => Math.round(x * 100) / 100

describe('placar: quem está atrasado ainda volta? (C-014, H3)', () => {
  const linhas = CENARIOS.map((c) => {
    const xs = fotos(c.nome)
    return {
      cenario: c.nome,
      atrasados: xs.length,
      'voltaram %': Math.round((100 * xs.filter((f) => f.voltou).length) / xs.length),
      'AUC tabela': r2(auc(xs, (f) => f.tabela)),
      'AUC P(ativo)': r2(auc(xs, (f) => f.ativo)),
      'Brier tabela': r2(brier(xs, (f) => f.tabela)),
      'Brier P(ativo)': r2(brier(xs, (f) => f.ativo)),
    }
  })

  it('imprime o placar', () => {
    console.table(linhas)
    expect(linhas.every((l) => l.atrasados > 30)).toBe(true)
  })

  /** Pisos medidos no C-014. A tabela de hoje só tem 3 valores para quem está atrasado; P(ativo) ordena dentro deles. */
  const PISO_AUC: Record<string, number> = {
    'regular (21±2)': 0.97,
    'deriva (21 → 35)': 0.95,
    'pulo (21, às vezes 42)': 0.79,
    'errático (14–45)': 0.86,
    'padrão errado (70±5, padrão 21)': 0.95,
  }

  it.each(CENARIOS.map((c) => c.nome))('%s: P(ativo) ordena a fila pelo menos tão bem quanto a tabela, no piso medido', (nome) => {
    const l = linhas.find((x) => x.cenario === nome)!
    expect(l['AUC P(ativo)']).toBeGreaterThanOrEqual(l['AUC tabela'])
    expect(l['AUC P(ativo)']).toBeGreaterThanOrEqual(PISO_AUC[nome]!)
  })

  /**
   * Tetos de Brier medidos no C-014. A ORDEM quase não depende da largura da curva (vem do silêncio ÷
   * ritmo); a CALIBRAÇÃO depende. Sem estes tetos, uma curva 10× mais larga passava (mutação do C-014).
   */
  const TETO_BRIER: Record<string, number> = {
    'regular (21±2)': 0.15,
    'deriva (21 → 35)': 0.13,
    'pulo (21, às vezes 42)': 0.18,
    'errático (14–45)': 0.15,
    'padrão errado (70±5, padrão 21)': 0.15,
  }

  it.each(CENARIOS.map((c) => c.nome))('%s: Brier de P(ativo) no teto medido', (nome) => {
    expect(linhas.find((x) => x.cenario === nome)!['Brier P(ativo)']).toBeLessThanOrEqual(TETO_BRIER[nome]!)
  })
})

describe('probabilidade de ativo de um cliente (C-014)', () => {
  const d = (s: string) => Temporal.PlainDate.from(s)
  const historico = (gaps: number[]) => {
    let dia = d('2026-01-05')
    const h = [{ date: dia }]
    for (const g of gaps) h.push({ date: (dia = dia.add({ days: g })) })
    return h
  }
  const p = (gaps: number[], silencio: number, extra: { hasFutureAppointment?: boolean } = {}) => {
    const history = historico(gaps)
    return probabilidadeDeAtivo({ history, defaultCycleDays: 21, today: history[history.length - 1]!.date.add({ days: silencio }), ...extra })
  }

  it('cai com o silêncio', () => {
    const regular = [21, 20, 22, 21, 21, 20]
    expect(p(regular, 10)).toBeGreaterThan(p(regular, 30))
    expect(p(regular, 30)).toBeGreaterThan(p(regular, 60))
  })

  it('o mesmo silêncio pesa mais para quem é relógio do que para quem varia', () => {
    expect(p([21, 20, 22, 21, 21, 20], 35)).toBeLessThan(p([12, 35, 18, 30, 15, 28], 35))
  })

  it('agendamento futuro: ativo', () => {
    expect(p([21, 21, 21], 90, { hasFutureAppointment: true })).toBe(1)
  })
})

