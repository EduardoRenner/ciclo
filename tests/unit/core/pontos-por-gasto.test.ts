import { describe, expect, it } from 'vitest'

import { pontosPorGasto } from '@/core/loyalty/pontos'
import { estimativaParaDuracao } from '@/core/pricing/formatar'

/**
 * Duas contas da mesma forma errada: dividir antes de multiplicar. `priceCents / 100` e
 * `duracaoMin / 60` quase nunca têm representação binária exata, e o arredondamento seguinte pega
 * a sobra e vira um ponto (ou um centavo) inteiro.
 *
 * As duas erram CONTRA quem paga: a fidelidade credita um ponto a menos, a estimativa por hora
 * cobra um centavo a mais.
 *
 * `core/pricing/sinal.ts` já fazia `(precoCents * depositBps) / 10_000` — a ordem certa existia na
 * casa, e eram estas duas que estavam fora do padrão.
 */

/** A forma antiga, para o teste comparar contra ela em vez de contra um número escrito à mão. */
const antigoPontos = (cents: number, p: number) => Math.floor((cents / 100) * p)
const antigoPorHora = (min: number, cents: number) => Math.ceil((min / 60) * cents)

describe('pontosPorGasto multiplica antes de dividir', () => {
  it('os casos medidos: sempre um ponto a menos na conta antiga', () => {
    // Levantados varrendo a faixa que `EsquemaConfigFidelidade` aceita (`int` 0..100).
    const casos: [number, number, number][] = [
      [29, 100, 29],
      [57, 100, 57],
      [58, 50, 29],
      [70, 90, 63],
      [113, 100, 113],
    ]
    for (const [cents, porReal, esperado] of casos) {
      expect(pontosPorGasto(cents, porReal)).toBe(esperado)
      expect(antigoPontos(cents, porReal)).toBe(esperado - 1)
    }
  })

  it('nenhuma divergência sobra na faixa inteira que o esquema aceita', () => {
    /*
     * A varredura é o teste porque a primeira medição que fiz me enganou: com `pointsPerReal` em
     * {1, 2, 3, 5, 10} não há UMA divergência, e eu quase registrei "sem defeito". O defeito mora
     * nos valores redondos maiores — 15, 25, 30, 45, 50... — que são justamente os que alguém
     * escolhe ao montar um programa generoso.
     */
    let divergentes = 0
    for (let cents = 1; cents <= 30_000; cents += 7) {
      for (let porReal = 0; porReal <= 100; porReal += 5) {
        const exato = Math.floor((cents * porReal) / 100)
        if (pontosPorGasto(cents, porReal) !== exato) divergentes++
      }
    }
    expect(divergentes).toBe(0)
  })

  it('a varredura não passaria com a conta antiga — senão ela não prova nada', () => {
    // Guarda contra o próprio detector: se a faixa varrida deixasse de conter algum caso ruim,
    // o teste acima ficaria verde sem medir nada.
    let divergentes = 0
    for (let cents = 1; cents <= 30_000; cents += 7) {
      for (let porReal = 0; porReal <= 100; porReal += 5) {
        if (antigoPontos(cents, porReal) !== Math.floor((cents * porReal) / 100)) divergentes++
      }
    }
    expect(divergentes).toBeGreaterThan(0)
  })

  it('desligado e valores degenerados dão zero, sem NaN', () => {
    expect(pontosPorGasto(5000, 0)).toBe(0)
    expect(pontosPorGasto(0, 10)).toBe(0)
    expect(pontosPorGasto(-100, 10)).toBe(0)
  })
})

describe('estimativaParaDuracao multiplica antes de dividir', () => {
  const hourly = { pricingModel: 'hourly' as const, priceCents: 1200, hourlyRateCents: null, halfDayPriceCents: null }

  it('23 min a R$ 12/h: 460, não 461', () => {
    expect(estimativaParaDuracao(hourly, 23)).toBe(460)
    expect(antigoPorHora(23, 1200)).toBe(461)
  })

  it('nenhuma divergência sobra em duração e preço realistas', () => {
    let divergentes = 0
    for (let min = 1; min <= 480; min += 1) {
      for (let cents = 1000; cents <= 30_000; cents += 500) {
        if (estimativaParaDuracao({ ...hourly, priceCents: cents }, min) !== Math.ceil((min * cents) / 60)) divergentes++
      }
    }
    expect(divergentes).toBe(0)
  })

  it('hora cheia continua exata, e `visit_hourly` soma a visita à parte', () => {
    expect(estimativaParaDuracao(hourly, 60)).toBe(1200)
    expect(
      estimativaParaDuracao({ pricingModel: 'visit_hourly', priceCents: 5000, hourlyRateCents: 1200, halfDayPriceCents: null }, 23),
    ).toBe(5460)
  })
})
