import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { decomporVariacao, janelasComparaveis } from '@/core/inteligencia/explicar'

const d = (s: string) => Temporal.PlainDate.from(s)

describe('janelasComparaveis — os mesmos dias, nunca mês pela metade contra mês inteiro', () => {
  it('mês corrente: 1 a hoje contra 1 ao mesmo dia do mês anterior', () => {
    expect(janelasComparaveis('2026-09', d('2026-09-29'))).toEqual({
      agora: { inicio: '2026-09-01', fimExclusivo: '2026-09-30', rotulo: '1 a 29 de setembro' },
      antes: { inicio: '2026-08-01', fimExclusivo: '2026-08-30', rotulo: '1 a 29 de agosto' },
      parcial: true,
    })
  })

  it('dia 31 com o mês anterior de 30: o anterior entra inteiro, não transborda para o mês seguinte', () => {
    const c = janelasComparaveis('2026-10', d('2026-10-31'))!
    expect(c.antes).toEqual({ inicio: '2026-09-01', fimExclusivo: '2026-10-01', rotulo: '1 a 30 de setembro' })
  })

  it('mês fechado contra o anterior inteiro', () => {
    const c = janelasComparaveis('2026-08', d('2026-09-29'))!
    expect(c.agora.rotulo).toBe('agosto de 2026')
    expect(c.antes).toEqual({ inicio: '2026-07-01', fimExclusivo: '2026-08-01', rotulo: 'julho de 2026' })
    expect(c.parcial).toBe(false)
  })

  it('fevereiro fechado contra os mesmos 28 dias de janeiro', () => {
    expect(janelasComparaveis('2026-02', d('2026-05-10'))!.antes.rotulo).toBe('1 a 28 de janeiro')
  })

  it('dia 1º: um dia contra um dia', () => {
    expect(janelasComparaveis('2026-09', d('2026-09-01'))!.antes.rotulo).toBe('1º de agosto')
  })

  it('mês que ainda não começou: nada a explicar', () => {
    expect(janelasComparaveis('2026-10', d('2026-09-29'))).toBeNull()
  })
})

describe('decomporVariacao — as duas partes somam a diferença até o centavo', () => {
  it('caiu por volume: menos atendimentos, mesmo valor médio', () => {
    const r = decomporVariacao({ atendimentos: 48, receitaCents: 480_000 }, { atendimentos: 40, receitaCents: 400_000 })
    expect(r).toEqual({ deltaCents: -80_000, deltaBps: -1667, efeitoAtendimentosCents: -80_000, efeitoValorMedioCents: 0, valorMedioAntesCents: 10_000, valorMedioAgoraCents: 10_000 })
  })

  it('caiu por valor médio: mesmos atendimentos, mais barato', () => {
    const r = decomporVariacao({ atendimentos: 40, receitaCents: 480_000 }, { atendimentos: 40, receitaCents: 400_000 })
    expect(r.efeitoAtendimentosCents).toBe(0)
    expect(r.efeitoValorMedioCents).toBe(-80_000)
  })

  it('os dois mexeram: a soma fecha exata, mesmo com dízima no valor médio', () => {
    const r = decomporVariacao({ atendimentos: 37, receitaCents: 412_345 }, { atendimentos: 29, receitaCents: 351_010 })
    expect(r.efeitoAtendimentosCents + r.efeitoValorMedioCents).toBe(r.deltaCents)
    expect(Number.isInteger(r.efeitoAtendimentosCents) && Number.isInteger(r.efeitoValorMedioCents)).toBe(true)
  })

  it('sem receita antes: sem percentual (nunca "infinito%")', () => {
    expect(decomporVariacao({ atendimentos: 0, receitaCents: 0 }, { atendimentos: 3, receitaCents: 30_000 }).deltaBps).toBeNull()
  })
})
