import { describe, expect, it } from 'vitest'

import { precoComPercentual, simularContratacao, simularPreco } from '@/core/inteligencia/simular'

describe('simularPreco — três cenários e o empate, nunca um número só', () => {
  it('corte de R$ 45 para R$ 55 com 30 atendimentos', () => {
    const s = simularPreco({ precoAtualCents: 4_500, precoNovoCents: 5_500, atendimentos: 30 })!
    expect(s.receitaHojeCents).toBe(135_000)
    expect(s.cenarios).toEqual([
      { perda: 0, unidade: 'em_dez', atendimentos: 30, receitaCents: 165_000, diferencaCents: 30_000 },
      { perda: 1, unidade: 'em_dez', atendimentos: 27, receitaCents: 148_500, diferencaCents: 13_500 },
      { perda: 2, unidade: 'em_dez', atendimentos: 24, receitaCents: 132_000, diferencaCents: -3_000 },
    ])
    // 1 − 45/55 = 18,18%: até 18 em cada 100 podem sair (arredonda PARA BAIXO — a favor da cautela).
    expect(s.empateEmCem).toBe(18)
    expect(s.aumento).toBe(true)
  })

  it('volume que não divide por 10 arredonda o cenário para BAIXO — nunca otimista', () => {
    expect(simularPreco({ precoAtualCents: 100, precoNovoCents: 200, atendimentos: 17 })!.cenarios[1]!.atendimentos).toBe(15)
  })

  it('volume pequeno conta em PESSOAS, e cenário repetido não aparece duas vezes (medido no navegador)', () => {
    // 5 cortes em 90 dias: "1 em cada 10" e "2 em cada 10" davam os mesmos 4 atendimentos.
    const s = simularPreco({ precoAtualCents: 8_000, precoNovoCents: 9_500, atendimentos: 5 })!
    expect(s.cenarios.map((c) => [c.unidade, c.perda, c.atendimentos])).toEqual([['pessoas', 0, 5], ['pessoas', 1, 4], ['pessoas', 2, 3]])
    // 1 atendimento: não dá para perder 2 pessoas.
    expect(simularPreco({ precoAtualCents: 8_000, precoNovoCents: 9_500, atendimentos: 1 })!.cenarios.map((c) => c.atendimentos)).toEqual([1, 0])
  })

  it('redução: quantos a mais em cada 100 precisam vir para empatar (arredonda PARA CIMA)', () => {
    const s = simularPreco({ precoAtualCents: 6_000, precoNovoCents: 5_000, atendimentos: 20 })!
    expect(s.aumento).toBe(false)
    expect(s.empateEmCem).toBe(20)
    // Na redução os cenários são de GENTE A MAIS (perda negativa), nunca de gente a menos.
    expect(s.cenarios.map((c) => [c.perda, c.atendimentos])).toEqual([[0, 20], [-1, 22], [-2, 24]])
  })

  it('empate em inteiros: nenhum caso vizinho de dízima vira 1 ponto a mais', () => {
    // 3000 → 2500: exatamente 20 a mais em cada 100. Em ponto flutuante, 3000/2500 − 1 = 0,19999…
    // ou 0,2000…04 conforme a conta, e o ceil daria 21 num deles.
    for (const [p0, p1, esperado] of [[3_000, 2_500, 20], [6_000, 5_000, 20], [1_100, 1_000, 10], [7_000, 5_000, 40]] as const) {
      expect(simularPreco({ precoAtualCents: p0, precoNovoCents: p1, atendimentos: 10 })!.empateEmCem, `${p0}→${p1}`).toBe(esperado)
    }
  })

  it('preço igual, zero ou negativo: nada a simular', () => {
    expect(simularPreco({ precoAtualCents: 4_500, precoNovoCents: 4_500, atendimentos: 10 })).toBeNull()
    expect(simularPreco({ precoAtualCents: 0, precoNovoCents: 4_500, atendimentos: 10 })).toBeNull()
  })

  it('percentual vira centavos inteiros', () => {
    expect(precoComPercentual(4_500, 1_000, true)).toBe(4_950)
    expect(precoComPercentual(4_500, 750, false)).toBe(4_163)
  })
})

describe('simularContratacao — quantos atendimentos para se pagar, pelo que SOBRA', () => {
  it('R$ 2.500 por mês, sobrando R$ 25 por atendimento: 100 atendimentos', () => {
    expect(simularContratacao({ custoMensalCents: 250_000, atendimentos: 120, sobraCents: 300_000, dias: 30 })).toEqual({
      sobraPorAtendimentoCents: 2_500,
      atendimentosParaSePagar: 100,
      atendimentosHojePorMes: 120,
    })
  })

  it('arredonda para cima: 99,1 atendimentos são 100', () => {
    expect(simularContratacao({ custoMensalCents: 250_000, atendimentos: 1, sobraCents: 2_523, dias: 30 })!.atendimentosParaSePagar).toBe(100)
  })

  it('não sobra nada por atendimento: sem conta (e a resposta tem que dizer por quê)', () => {
    expect(simularContratacao({ custoMensalCents: 250_000, atendimentos: 50, sobraCents: 0, dias: 30 })).toBeNull()
    expect(simularContratacao({ custoMensalCents: 250_000, atendimentos: 0, sobraCents: 0, dias: 30 })).toBeNull()
  })
})
