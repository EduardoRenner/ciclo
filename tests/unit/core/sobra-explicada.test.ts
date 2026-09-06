import { describe, expect, it } from 'vitest'

import { explicarSobra } from '@/core/comanda/sobra-explicada'

const COMPLETA = {
  subtotalCents: 10_000,
  discountCents: 0,
  tipCents: 0,
  materialCents: 2_500,
  feeCents: 349,
  commissionCents: 4_000,
  taxaRespondida: true,
  servicosSemFicha: 0,
}

describe('explicarSobra — o valor e o que falta nele, sempre juntos', () => {
  it('conta completa: receita menos material, taxa e comissão', () => {
    const r = explicarSobra(COMPLETA)
    expect(r.receitaCents).toBe(10_000)
    expect(r.sobraCents).toBe(10_000 - 2_500 - 349 - 4_000)
    expect(r.lacunas).toEqual([])
    expect(r.frase, 'conta completa não pode gerar aviso — aviso que sempre aparece deixa de ser lido').toBeNull()
  })

  it('o desconto sai da receita, não some do relatório', () => {
    const r = explicarSobra({ ...COMPLETA, discountCents: 2_000 })
    expect(r.receitaCents).toBe(8_000)
    expect(r.sobraCents).toBe(8_000 - 2_500 - 349 - 4_000)
  })

  it('a gorjeta não vira lucro do salão, nem entra na receita', () => {
    const semGorjeta = explicarSobra(COMPLETA)
    const comGorjeta = explicarSobra({ ...COMPLETA, tipCents: 3_000 })
    expect(comGorjeta.sobraCents).toBe(semGorjeta.sobraCents)
    expect(comGorjeta.receitaCents).toBe(semGorjeta.receitaCents)
  })

  it('desconto maior que o subtotal não vira receita negativa', () => {
    expect(explicarSobra({ ...COMPLETA, discountCents: 99_000 }).receitaCents).toBe(0)
  })

  it('comanda que deu prejuízo mostra prejuízo, não zero', () => {
    const r = explicarSobra({ ...COMPLETA, commissionCents: 9_000 })
    expect(r.sobraCents).toBeLessThan(0)
  })
})

describe('explicarSobra — as lacunas', () => {
  it('taxa não respondida vira lacuna, frase e detalhe', () => {
    const r = explicarSobra({ ...COMPLETA, taxaRespondida: false })
    expect(r.lacunas).toEqual(['taxa'])
    expect(r.frase).toBe('Falta descontar a taxa da maquininha.')
    expect(r.detalhes).toEqual(['você ainda não informou quanto a maquininha cobra'])
  })

  /**
   * O caso que separa "respondeu zero" de "não respondeu". Um salão só de dinheiro e Pix tem taxa
   * zero de verdade — para ele a conta está completa, e cobrar de novo a resposta que ele já deu
   * seria ruído permanente.
   */
  it('taxa respondida como zero NÃO é lacuna', () => {
    const r = explicarSobra({ ...COMPLETA, feeCents: 0, taxaRespondida: true })
    expect(r.lacunas).toEqual([])
    expect(r.frase).toBeNull()
  })

  it('serviço sem ficha vira lacuna, com o número de serviços no detalhe', () => {
    const um = explicarSobra({ ...COMPLETA, materialCents: 0, servicosSemFicha: 1 })
    expect(um.frase).toBe('Falta descontar o produto.')
    expect(um.detalhes).toEqual(['1 serviço desta comanda ainda não tem ficha de consumo'])

    const tres = explicarSobra({ ...COMPLETA, materialCents: 0, servicosSemFicha: 3 })
    expect(tres.detalhes).toEqual(['3 serviços desta comanda ainda não têm ficha de consumo'])
  })

  /**
   * A versão anterior desta frase empilhava as duas explicações numa oração só e saía
   * *"...que ainda não têm ficha de consumo e a taxa da maquininha, que você ainda não
   * informou"* — válido e ilegível. O que falta fica curto; o porquê vai por fora, um por linha.
   */
  it('as duas lacunas juntas: uma frase curta e dois detalhes', () => {
    const r = explicarSobra({ ...COMPLETA, materialCents: 0, feeCents: 0, taxaRespondida: false, servicosSemFicha: 2 })
    expect(r.lacunas).toEqual(['ficha', 'taxa'])
    expect(r.frase).toBe('Falta descontar o produto e a taxa da maquininha.')
    expect(r.detalhes).toHaveLength(2)
    expect(r.frase!.length, 'a frase voltou a carregar a explicação inteira').toBeLessThan(60)
  })

  it('as três linhas de desconto aparecem mesmo valendo zero — zero é resposta', () => {
    const r = explicarSobra({ ...COMPLETA, materialCents: 0, feeCents: 0, commissionCents: 0 })
    expect(r.descontos.map((d) => d.rotulo)).toEqual(['Material', 'Taxa da maquininha', 'Comissão'])
  })
})
