import { describe, expect, it } from 'vitest'

import { computeNoShowScore, LIMIAR_ALERTA_AGENDA, LIMIAR_SINAL_OBRIGATORIO, type EntradaScoreRisco } from '@/core/risk/no-show-score'

const CLAMP_MAX_ESPERADO = 0.1 + 0.25 + 0.3

const BASE: EntradaScoreRisco = {
  faltasAnteriores: 0,
  primeiraVisita: false,
  antecedenciaDias: 3,
  confirmouAte12hAntes: true,
  horaLocal: 10,
  sabado: false,
  pagouSinal: false,
  assinanteDoClube: false,
  atendimentosSemFalta: 0,
}

describe('computeNoShowScore — §5.4', () => {
  it('caso neutro: só a base, 0,10', () => {
    expect(computeNoShowScore(BASE).score).toBeCloseTo(0.1, 5)
  })

  it('já faltou 1 vez: +0,25, sem adicional (a primeira falta já é a que soma os 0,25)', () => {
    const r = computeNoShowScore({ ...BASE, faltasAnteriores: 1 })
    expect(r.score).toBeCloseTo(0.35, 5)
  })

  it('faltou 3 vezes: +0,25 + 2×0,15 de adicional', () => {
    const r = computeNoShowScore({ ...BASE, faltasAnteriores: 3 })
    expect(r.score).toBeCloseTo(0.1 + 0.25 + 2 * 0.15, 5)
  })

  it('adicional de faltas trava em +0,30 mesmo com muitas faltas', () => {
    const r = computeNoShowScore({ ...BASE, faltasAnteriores: 20 })
    expect(r.score).toBeCloseTo(CLAMP_MAX_ESPERADO, 5)
  })

  it('primeira visita soma 0,15', () => {
    expect(computeNoShowScore({ ...BASE, primeiraVisita: true }).score).toBeCloseTo(0.25, 5)
  })

  it('agendou com mais de 14 dias de antecedência soma 0,10', () => {
    expect(computeNoShowScore({ ...BASE, antecedenciaDias: 15 }).score).toBeCloseTo(0.2, 5)
  })

  it('antecedência de exatos 14 dias NÃO soma (é "mais de 14")', () => {
    expect(computeNoShowScore({ ...BASE, antecedenciaDias: 14 }).score).toBeCloseTo(0.1, 5)
  })

  it('não confirmou até 12h antes soma 0,10', () => {
    expect(computeNoShowScore({ ...BASE, confirmouAte12hAntes: false }).score).toBeCloseTo(0.2, 5)
  })

  it('horário depois das 18h soma 0,10', () => {
    expect(computeNoShowScore({ ...BASE, horaLocal: 19 }).score).toBeCloseTo(0.2, 5)
  })

  it('sábado soma 0,10 mesmo de manhã (não depende da hora)', () => {
    expect(computeNoShowScore({ ...BASE, sabado: true, horaLocal: 9 }).score).toBeCloseTo(0.2, 5)
  })

  it('depois das 18h de sábado soma só uma vez — a regra é "ou", não as duas somadas', () => {
    expect(computeNoShowScore({ ...BASE, sabado: true, horaLocal: 19 }).score).toBeCloseTo(0.2, 5)
  })

  // As três reduções sozinhas, a partir da base 0,10, dariam negativo e o
  // clamp de piso (0,02) esconderia a magnitude real do redutor — por isso
  // partem de `primeiraVisita: true` (base 0,25) para o subtraído sobrar
  // visível acima do piso.
  it('pagou sinal subtrai 0,20', () => {
    expect(computeNoShowScore({ ...BASE, primeiraVisita: true, pagouSinal: true }).score).toBeCloseTo(0.05, 5)
  })

  it('assinante do clube subtrai 0,15', () => {
    expect(computeNoShowScore({ ...BASE, primeiraVisita: true, assinanteDoClube: true }).score).toBeCloseTo(0.1, 5)
  })

  it('5+ atendimentos sem falta subtrai 0,10', () => {
    expect(computeNoShowScore({ ...BASE, primeiraVisita: true, atendimentosSemFalta: 5 }).score).toBeCloseTo(0.15, 5)
  })

  it('4 atendimentos sem falta NÃO subtrai (o limiar é "5+")', () => {
    expect(computeNoShowScore({ ...BASE, atendimentosSemFalta: 4 }).score).toBeCloseTo(0.1, 5)
  })

  it('clamp no piso: caso com muitos redutores nunca fica abaixo de 0,02', () => {
    const r = computeNoShowScore({ ...BASE, pagouSinal: true, assinanteDoClube: true, atendimentosSemFalta: 5 })
    expect(r.score).toBeCloseTo(0.02, 5)
  })

  it('clamp no teto: caso com tudo que soma nunca passa de 0,95', () => {
    const r = computeNoShowScore({
      faltasAnteriores: 20,
      primeiraVisita: true,
      antecedenciaDias: 30,
      confirmouAte12hAntes: false,
      horaLocal: 20,
      sabado: true,
      pagouSinal: false,
      assinanteDoClube: false,
      atendimentosSemFalta: 0,
    })
    expect(r.score).toBeLessThanOrEqual(0.95)
  })

  it('limiares exportados batem com §5.4: 0,45 para sinal obrigatório, 0,60 para alerta na agenda', () => {
    expect(LIMIAR_SINAL_OBRIGATORIO).toBe(0.45)
    expect(LIMIAR_ALERTA_AGENDA).toBe(0.6)
  })

  it('devolve as features usadas, para gravar em risk_features', () => {
    const entrada = { ...BASE, primeiraVisita: true }
    expect(computeNoShowScore(entrada).features).toEqual(entrada)
  })
})
