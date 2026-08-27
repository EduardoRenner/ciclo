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
    // clamp: 0.5×70=35, 2.5×70=175 — a mediana dos últimos 5 (21) cai abaixo
    // do piso e é esticada até 35. O teste de clamp cobre isso; aqui só
    // confirma que o outlier de 200 não entrou na mediana dos 5 mais recentes
    // (se tivesse entrado, o resultado teria sido bem mais alto que 35).
    expect(r.personalCycleDays).toBe(35)
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

  it('clamp: gap muito longo não deixa o ciclo pessoal passar de 2,5× o padrão', () => {
    // No braço de 1-2 gaps o blend 60/40 com o padrão amortece tanto que,
    // combinado com o próprio descarte de gaps > 3×padrão, nunca ultrapassa
    // o teto — é matematicamente impossível estourar por ali. O teto só é
    // alcançável no braço de 3+ gaps (mediana pura, sem blend). 5 gaps perto
    // do limite de descarte (30 ≤ 3×10), mediana 29, padrão 10 → teto 25.
    const r = computeCycle({
      history: historicoDeGaps('2026-01-01', [29, 30, 28, 30, 29]),
      defaultCycleDays: 10,
      today: dia('2026-01-01'),
    })
    expect(r.personalCycleDays).toBe(25)
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
