import { describe, expect, it } from 'vitest'

import { avaliarSeed, type MedidaDoNegocio } from '../../../scripts/conferir-seed.mjs'

/** Um negócio plausível: 90% de comparecimento, dias e horas espalhados, Motor rodado, logins. */
function plausivel(extra: Partial<MedidaDoNegocio> = {}): MedidaDoNegocio {
  return {
    slug: 'demo-x',
    feitos: 90,
    faltas: 10,
    porDia: [0, 0, 20, 20, 20, 20, 20],
    porHora: [0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 0, 0, 0, 0, 0],
    diasComEntrada: 8,
    comandasSemForma: 0,
    ciclos: 20,
    recuperar: 12,
    loginProfissional: true,
    loginRecepcao: true,
    ...extra,
  }
}

describe('avaliarSeed (APR-037)', () => {
  it('controle positivo: um negócio plausível passa sem falha', () => {
    expect(avaliarSeed([plausivel()])).toEqual([])
  })

  it('o seed medido em 13/10 reprova em cada regra', () => {
    const falhas = avaliarSeed([
      plausivel({
        feitos: 67,
        faltas: 0,
        porDia: [0, 0, 37, 10, 10, 5, 5],
        porHora: Array.from({ length: 24 }, (_, h) => (h === 9 ? 60 : h === 10 ? 7 : 0)),
        diasComEntrada: 1,
        comandasSemForma: 67,
        ciclos: 0,
        recuperar: 0,
        loginProfissional: false,
        loginRecepcao: false,
      }),
    ])
    expect(falhas.join('\n')).toMatch(/comparecimento 100%/)
    expect(falhas.join('\n')).toMatch(/55% dos horários num só dia/)
    expect(falhas.join('\n')).toMatch(/90% dos horários numa só hora/)
    expect(falhas.join('\n')).toMatch(/em 1 dos últimos 14 dias/)
    expect(falhas.join('\n')).toMatch(/67 comandas fechadas sem forma/)
    expect(falhas.join('\n')).toMatch(/Motor de Ciclo não rodou/)
    expect(falhas.join('\n')).toMatch(/pessoas para recuperar/)
    expect(falhas.join('\n')).toMatch(/login de profissional/)
    expect(falhas.join('\n')).toMatch(/login de recepção/)
  })

  it('comparecimento baixo demais também reprova (falta demais é tão falso quanto nenhuma)', () => {
    expect(avaliarSeed([plausivel({ feitos: 60, faltas: 40 })]).join('\n')).toMatch(/comparecimento 60%/)
  })

  it('sem negócio nenhum, grita em vez de passar vazio', () => {
    expect(avaliarSeed([])).toEqual([expect.stringMatching(/nenhum negócio de demonstração/)])
  })

  it('recuperar e logins valem para o conjunto: basta um negócio cumprir', () => {
    const falhas = avaliarSeed([plausivel(), plausivel({ slug: 'demo-y', recuperar: 0, loginProfissional: false, loginRecepcao: false })])
    expect(falhas).toEqual([])
  })
})
