import { describe, expect, it } from 'vitest'

import { MINIMO_DE_PROCURAS, montarMapaDeVazamento, type EntradaDoMapa } from '@/core/caixa/mapa-de-vazamento'

const VAZIO: EntradaDoMapa = { recuperar: { pessoas: 0, lucroCents: 0 }, clube: [], servicosAbaixoDoPiso: [], procurasEmDiaFechado: [], diaOcioso: null }

describe('mapa de vazamento (docs/84 Aposta B)', () => {
  it('nada qualifica: lista vazia — nunca "tudo certo" forçado nem vilão fabricado', () => {
    expect(montarMapaDeVazamento(VAZIO)).toEqual([])
  })

  it('R$ só onde o dinheiro é MEDIDO; margem, dia parado e dia procurado entram como fato, sem R$ (docs/84 §7.1 e veto de preço)', () => {
    const mapa = montarMapaDeVazamento({
      recuperar: { pessoas: 12, lucroCents: 84_000 },
      clube: [{ margemCents: -3_000, noPrejuizo: true }, { margemCents: -1_500, noPrejuizo: true }, { margemCents: 2_000, noPrejuizo: false }],
      servicosAbaixoDoPiso: [{ nome: 'Coloração', parcela: 'material' }],
      procurasEmDiaFechado: [{ weekday: 0, procuras: 5 }],
      diaOcioso: { weekday: 2, semanasSeguidasVazias: 4, semanasObservadas: 8 },
    })
    expect(mapa.map((l) => [l.chave, l.valorCents])).toEqual([
      ['recuperar', 84_000],
      ['clube', 4_500],
      ['margem', null],
      ['dia_fechado', null],
      ['dia_parado', null],
    ])
    // Cada linha leva a uma ação que já existe.
    expect(mapa.every((l) => l.href.startsWith('/admin/'))).toBe(true)
  })

  it('o maior R$ vem primeiro', () => {
    const mapa = montarMapaDeVazamento({ ...VAZIO, recuperar: { pessoas: 1, lucroCents: 1_000 }, clube: [{ margemCents: -9_000, noPrejuizo: true }] })
    expect(mapa.map((l) => l.chave)).toEqual(['clube', 'recuperar'])
  })

  it('margem baixa não diz quanto se "perde" — seria sugerir preço por outra porta', () => {
    const [linha] = montarMapaDeVazamento({ ...VAZIO, servicosAbaixoDoPiso: [{ nome: 'Coloração', parcela: 'comissao' }] })
    expect(linha!.valorCents).toBeNull()
    expect(linha!.fato).toMatch(/quem mais come é a comissão/)
    expect(linha!.fato).toMatch(/Quanto é o certo, só você sabe/)
    expect(linha!.fato).not.toMatch(/R\$|deveria|sugiro|recomendo/)
  })

  it(`dia fechado só vira linha com ${MINIMO_DE_PROCURAS} procuras ou mais — uma solta é acaso`, () => {
    expect(montarMapaDeVazamento({ ...VAZIO, procurasEmDiaFechado: [{ weekday: 0, procuras: MINIMO_DE_PROCURAS - 1 }] })).toEqual([])
    const [linha] = montarMapaDeVazamento({ ...VAZIO, procurasEmDiaFechado: [{ weekday: 0, procuras: MINIMO_DE_PROCURAS }] })
    expect(linha!.titulo).toBe('Gente procurando horário no domingo')
    expect(linha!.fato).toMatch(/Procura não é atendimento/)
  })

  it('concordância: "no domingo/sábado", "na terça"; "o dia mais parado", sem gênero no dia', () => {
    expect(montarMapaDeVazamento({ ...VAZIO, procurasEmDiaFechado: [{ weekday: 2, procuras: 4 }] })[0]!.titulo).toBe('Gente procurando horário na terça')
    expect(montarMapaDeVazamento({ ...VAZIO, diaOcioso: { weekday: 0, semanasSeguidasVazias: 3, semanasObservadas: 6 } })[0]!.titulo).toBe('O dia mais parado: domingo')
  })

  it('clube que dá lucro não é vazamento', () => {
    expect(montarMapaDeVazamento({ ...VAZIO, clube: [{ margemCents: 5_000, noPrejuizo: false }] })).toEqual([])
  })
})
