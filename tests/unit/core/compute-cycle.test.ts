import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { computeCycle } from '@/core/cycle/compute'

const dia = (s: string) => Temporal.PlainDate.from(s)

/** Monta o histórico a partir de uma data inicial e uma lista de intervalos em dias. */
function historicoDeGaps(inicio: string, gaps: number[]): { date: Temporal.PlainDate }[] {
  let atual = dia(inicio)
  const visitas = [{ date: atual }]
  for (const g of gaps) {
    atual = atual.add({ days: g })
    visitas.push({ date: atual })
  }
  return visitas
}

describe('computeCycle — §5.3', () => {
  it('sem histórico: on_track, nada para prever', () => {
    const r = computeCycle({ history: [], defaultCycleDays: 21, today: dia('2026-06-01') })
    expect(r.state).toBe('on_track')
    expect(r.personalCycleDays).toBe(21)
  })

  it('1 visita (0 gaps): usa o padrão do serviço puro', () => {
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', []),
      defaultCycleDays: 21,
      today: dia('2026-01-22'), // exatamente no dia previsto
    })
    expect(r.personalCycleDays).toBe(21)
    expect(r.predictedDate.toString()).toBe('2026-01-22')
    expect(r.lateDays).toBe(0)
    expect(r.state).toBe('due')
  })

  it('1 gap (2 visitas): mistura 60% da mediana do gap com 40% do padrão', () => {
    // gap de 30 dias, padrão 21: 0.6*30 + 0.4*21 = 26.4
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [30]),
      defaultCycleDays: 21,
      today: dia('2026-01-31'),
    })
    expect(r.personalCycleDays).toBeCloseTo(26.4, 5)
    // predictedDate = última visita (2026-01-31) + round(26.4) = 26 dias
    expect(r.predictedDate.toString()).toBe(dia('2026-01-31').add({ days: 26 }).toString())
  })

  it('2 gaps (3 visitas): mediana é a média dos dois, ainda no blend 60/40', () => {
    // Dois gaps: 20 e 30 → mediana par = (20+30)/2 = 25. Blend: 0.6*25 + 0.4*21 = 23.4.
    // Cobre o ramo par de `mediana` E o `gaps.length <= 2` com exatamente 2.
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [20, 30]),
      defaultCycleDays: 21,
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBeCloseTo(23.4, 5)
  })

  it('5 gaps (6 visitas): mediana dos últimos 5, sem misturar com o padrão', () => {
    const gaps = [20, 22, 21, 19, 23] // mediana = 21
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', gaps),
      defaultCycleDays: 30, // bem diferente da mediana, para provar que não entra na conta
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBe(21)
  })

  it('mais de 5 gaps: só os últimos 5 entram na mediana', () => {
    // 6 gaps — o primeiro (200, um outlier enorme mas ainda < 3×default=210,
    // então não é descartado pela regra 2) precisa ficar de fora da mediana
    // por ser o mais antigo, não por ser grande.
    const gaps = [200, 20, 22, 21, 19, 23]
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', gaps),
      defaultCycleDays: 70,
      today: dia('2026-01-01'),
    })
    // v2 (docs/105-ciclo/C-001): com 3+ intervalos a referência é o próprio cliente (mediana 21,5),
    // não o padrão 70. O 200 sai pelo descarte (> 3×21,5) e pela janela dos 5; a mediana dos 5 é 21
    // e fica — a v1 esticava para 35 (piso de 0,5×70) uma cliente que volta a cada 21 dias.
    expect(r.personalCycleDays).toBe(21)
  })

  it('gap absurdo (> 3× o padrão) é descartado, não usado na conta', () => {
    // Sumiu 8 meses e voltou: não é ritmo, é exceção (regra 2). Sobra 1 gap
    // "normal" de 20 dias, que cai no braço de 1-2 gaps.
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [240, 20]),
      defaultCycleDays: 21,
      today: dia('2026-01-01'),
    })
    // Se o gap de 240 tivesse entrado, a mediana teria sido bem maior que 20.
    // 0.6*20 + 0.4*21 = 20.4
    expect(r.personalCycleDays).toBeCloseTo(20.4, 5)
  })

  it('clamp: gap muito curto não deixa o ciclo pessoal cair abaixo de 0,5× o padrão', () => {
    // gap de 2 dias, padrão 21: 0.6*2+0.4*21=9.6, abaixo do piso de 10.5.
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [2]),
      defaultCycleDays: 21,
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBe(10.5)
  })

  it('v2: ritmo provado (3+ intervalos coerentes) vence o padrão do serviço, sem o teto de 2,5× o padrão', () => {
    // Na v1, 5 intervalos de ~29 dias num serviço de padrão 10 davam 25 (teto 2,5×10): o produto
    // chamava a cliente 4 dias antes, toda vez. O backtest (C-001) mostrou o mesmo defeito em escala:
    // ritmo 70 com padrão 21 → erro mediano de 44 dias. Na v2 a referência é a mediana dela (29).
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [29, 30, 28, 30, 29]),
      defaultCycleDays: 10,
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBe(29)
  })

  it('v2: o teto continua valendo, agora relativo ao próprio cliente — um intervalo não estica o ciclo', () => {
    // 3 intervalos de 20 e um de 55 (< 3×mediana 20, não é descartado): mediana dos 4 = 20.
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [20, 20, 55, 20]),
      defaultCycleDays: 21,
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBe(20)
  })

  it('v2: com 1–2 intervalos nada muda — o padrão segue sendo a referência (ritmo não provado)', () => {
    // 1 intervalo de 50 num serviço de padrão 10: > 3×10, descartado → só o padrão.
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [50]),
      defaultCycleDays: 10,
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBe(10)
  })

  it('amostra (C-015): quantos intervalos formaram o ciclo pessoal; 0 quando é só o padrão', () => {
    const amostra = (gaps: number[]) => computeCycle({ history: historicoDeGaps('2026-01-01', gaps), defaultCycleDays: 21, today: dia('2026-01-01') }).amostra
    expect(computeCycle({ history: [], defaultCycleDays: 21, today: dia('2026-01-01') }).amostra).toBe(0)
    expect(amostra([])).toBe(0)
    expect(amostra([20])).toBe(1)
    expect(amostra([20, 22])).toBe(2)
    // Descartado como anomalia (> 3× o padrão) não conta.
    expect(amostra([90])).toBe(0)
    // 3+: a mediana ponderada olha os últimos 5.
    expect(amostra([20, 21, 22, 20, 21, 22, 20])).toBe(5)
  })

  it('v4: 2 intervalos que concordam e caem os dois acima da régua do padrão provam o ritmo, sem misturar com o padrão', () => {
    const ciclo = (gaps: number[]) => computeCycle({ history: historicoDeGaps('2026-01-01', gaps), defaultCycleDays: 21, today: dia('2026-01-01') }).personalCycleDays
    expect(ciclo([70, 72])).toBe(71)
    // Abaixo de metade do padrão NÃO prova (C-013): v3, mistura 60/40.
    expect(ciclo([8, 9])).toBeCloseTo(0.6 * 8.5 + 0.4 * 21)
    // Discordam (140 > 1,5 × 70): v3, os dois descartados → padrão.
    expect(ciclo([70, 140])).toBe(21)
    // Concordam, mas dentro da régua do padrão: v3, mistura 60/40.
    expect(ciclo([30, 32])).toBeCloseTo(0.6 * 31 + 0.4 * 21)
    // Um dentro e um fora: v3.
    expect(ciclo([60, 70])).toBeCloseTo(0.6 * 60 + 0.4 * 21)
  })

  it('agendamento futuro força on_track mesmo com o cálculo dizendo "lost"', () => {
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', []),
      defaultCycleDays: 21,
      today: dia('2026-06-01'), // bem depois do previsto — seria "lost"
      hasFutureAppointment: true,
    })
    expect(r.state).toBe('on_track')
  })

  it.each([
    [-10, 'on_track'],
    [-4, 'on_track'],
    [-3, 'due'],
    [0, 'due'],
    [1, 'late'],
    [10, 'late'],
    [11, 'at_risk'],
    [30, 'at_risk'],
    [31, 'lost'],
    [90, 'lost'],
  ] as const)('lateDays=%i vira estado %s (limites exatos da tabela §5.3.7)', (atrasoAlvo, esperado) => {
    const previsto = dia('2026-03-01')
    const r = computeCycle({
      history: historicoDeGaps(previsto.subtract({ days: 21 }).toString(), []),
      defaultCycleDays: 21,
      today: previsto.add({ days: atrasoAlvo }),
    })
    expect(r.state).toBe(esperado)
  })
})
