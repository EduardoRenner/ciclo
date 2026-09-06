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
  servicosComProdutoSemCusto: 0,
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

  /*
   * O defeito de 2026-09-06, no formato exato em que ele chegava na tela.
   *
   * Um salão de cabelo criado pelo `apply_vertical_pack` recebia a ficha de "Coloração" completa e
   * os produtos dela com custo de catálogo — tintura R$ 22,00, oxigenada R$ 0,03/ml. Então
   * `servicosSemFicha` valia 0, a lacuna nunca era levantada, e a comanda fechada mostrava
   * "Sobrou R$ 92,60" limpo, sem ressalva nenhuma, com R$ 24,60 de material que ninguém comprou.
   *
   * Um número inventado exibido com a cara de número completo é o defeito que este módulo inteiro
   * existe para impedir — e ele estava passando por baixo, porque a pergunta era "tem ficha?" e
   * não "o material é real?".
   */
  it('ficha completa com produto que nunca teve compra registrada é lacuna, e não conta fechada', () => {
    const r = explicarSobra({ ...COMPLETA, servicosSemFicha: 0, servicosComProdutoSemCusto: 1 })

    expect(r.lacunas, 'ficha semeada pelo pack não é material conferido').toContain('ficha')
    expect(r.frase).toBe('Falta descontar o produto.')
    expect(r.detalhes).toEqual(['1 serviço tem ficha, mas algum produto dela nunca teve compra registrada — ele entrou valendo zero'])
  })

  it('as duas causas do material incompleto aparecem como duas linhas, porque pedem coisas diferentes', () => {
    const r = explicarSobra({ ...COMPLETA, servicosSemFicha: 2, servicosComProdutoSemCusto: 3 })

    expect(r.lacunas).toEqual(['ficha'])
    expect(r.detalhes).toHaveLength(2)
    expect(r.detalhes[0]).toBe('2 serviços desta comanda ainda não têm ficha de consumo')
    expect(r.detalhes[1]).toBe('3 serviços têm ficha, mas algum produto delas nunca teve compra registrada — eles entraram valendo zero')
  })

  it('material conferido e taxa respondida continuam fechando a conta sem aviso', () => {
    const r = explicarSobra({ ...COMPLETA, servicosSemFicha: 0, servicosComProdutoSemCusto: 0 })
    expect(r.lacunas).toEqual([])
    expect(r.detalhes).toEqual([])
  })
})
