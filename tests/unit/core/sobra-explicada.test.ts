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
  itensComMaterialIncerto: 0,
  fixedCostCents: 0,
  custoFixoRespondido: true,
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

  it('item com material incerto vira lacuna, com o número de itens no detalhe', () => {
    const um = explicarSobra({ ...COMPLETA, materialCents: 0, itensComMaterialIncerto: 1 })
    expect(um.frase).toBe('Falta descontar o produto.')
    expect(um.detalhes).toEqual(['1 item entrou sem o custo real do produto: falta a ficha do serviço, ou falta registrar a compra do insumo'])

    const tres = explicarSobra({ ...COMPLETA, materialCents: 0, itensComMaterialIncerto: 3 })
    expect(tres.detalhes).toEqual(['3 itens entraram sem o custo real do produto: falta a ficha do serviço, ou falta registrar a compra do insumo'])
  })

  /**
   * A versão anterior desta frase empilhava as duas explicações numa oração só e saía
   * *"...que ainda não têm ficha de consumo e a taxa da maquininha, que você ainda não
   * informou"* — válido e ilegível. O que falta fica curto; o porquê vai por fora, um por linha.
   */
  it('as duas lacunas juntas: uma frase curta e dois detalhes', () => {
    const r = explicarSobra({ ...COMPLETA, materialCents: 0, feeCents: 0, taxaRespondida: false, itensComMaterialIncerto: 2 })
    expect(r.lacunas).toEqual(['ficha', 'taxa'])
    expect(r.frase).toBe('Falta descontar o produto e a taxa da maquininha.')
    expect(r.detalhes).toHaveLength(2)
    expect(r.frase!.length, 'a frase voltou a carregar a explicação inteira').toBeLessThan(60)
  })

  it('as quatro linhas de desconto aparecem mesmo valendo zero — zero é resposta', () => {
    const r = explicarSobra({ ...COMPLETA, materialCents: 0, feeCents: 0, commissionCents: 0, fixedCostCents: 0 })
    expect(r.descontos.map((d) => d.rotulo)).toEqual(['Material', 'Taxa da maquininha', 'Comissão', 'Aluguel e contas'])
  })

  /**
   * A quarta linha nasceu em 2026-09-06 e é a que separa lucro de margem de contribuição. Sem ela,
   * um corte de R$ 45 com 40% de comissão dizia "Sobrou R$ 24,00" para um dono que paga R$ 3.500
   * de aluguel — o `docs/47` P05 acusa o setor de mostrar faturamento com cara de lucro, e isto
   * era a mesma família dentro do produto que faz a acusação.
   */
  it('o aluguel entra na conta e sai da sobra', () => {
    const semAluguel = explicarSobra({ ...COMPLETA, fixedCostCents: 0 })
    const comAluguel = explicarSobra({ ...COMPLETA, fixedCostCents: 673 })
    expect(comAluguel.sobraCents).toBe(semAluguel.sobraCents - 673)
  })

  it('sem as três perguntas respondidas, o aluguel vira lacuna — e não zero silencioso', () => {
    const r = explicarSobra({ ...COMPLETA, fixedCostCents: 0, custoFixoRespondido: false })
    expect(r.lacunas).toContain('custo-fixo')
    expect(r.frase).toBe('Falta descontar o aluguel.')
    expect(r.detalhes[0]).toContain('quantas cadeiras')
  })

  /** Quem atende em casa responde zero de propósito, e para ele a conta está completa. */
  it('custo fixo respondido com zero não vira lacuna', () => {
    const r = explicarSobra({ ...COMPLETA, fixedCostCents: 0, custoFixoRespondido: true })
    expect(r.lacunas).not.toContain('custo-fixo')
  })

  /**
   * Três lacunas juntas precisam de vírgula antes do "e". Sem isso a frase vira uma enumeração com
   * dois "e" — "o produto e a taxa da maquininha e o aluguel" — e fica ilegível em 390 px, que é o
   * mesmo motivo pelo qual frase e detalhe vivem separados aqui.
   */
  it('as três lacunas juntas produzem uma frase legível', () => {
    const r = explicarSobra({
      ...COMPLETA,
      itensComMaterialIncerto: 1,
      taxaRespondida: false,
      custoFixoRespondido: false,
    })
    expect(r.lacunas).toEqual(['ficha', 'taxa', 'custo-fixo'])
    expect(r.frase).toBe('Falta descontar o produto, a taxa da maquininha e o aluguel.')
    expect(r.detalhes).toHaveLength(3)
  })

  /*
   * O defeito de 2026-09-06, no formato exato em que ele chegava na tela.
   *
   * Um salão de cabelo criado pelo `apply_vertical_pack` recebia a ficha de "Coloração" completa e
   * os produtos dela com custo de catálogo — tintura R$ 22,00, oxigenada R$ 0,03/ml. A pergunta que
   * a tela fazia era "tem ficha?", a resposta era "tem", e a comanda fechada mostrava
   * "Sobrou R$ 92,60" limpo, sem ressalva, com R$ 24,60 de material que ninguém comprou.
   *
   * Um número inventado exibido com a cara de número completo é o que este módulo inteiro existe
   * para impedir, e passava por baixo dele. Hoje a resposta vem congelada do lançamento do item
   * (`ticket_items.material_incerto`, `0070`) e cobre as duas razões.
   */
  it('item lançado sem custo real de produto é lacuna, e não conta fechada', () => {
    const r = explicarSobra({ ...COMPLETA, itensComMaterialIncerto: 1 })

    expect(r.lacunas, 'ficha semeada pelo pack não é material conferido').toContain('ficha')
    expect(r.frase).toBe('Falta descontar o produto.')
    expect(r.detalhes).toHaveLength(1)
    expect(r.detalhes[0]).toContain('falta registrar a compra do insumo')
  })

  /**
   * A frase nomeia as DUAS razões possíveis porque o registro congelado não guarda qual delas era
   * — e as duas pedem coisas diferentes do dono. Nomear só "monte a ficha" mandava ele conferir
   * uma ficha que o pack já tinha criado, e ele voltaria achando que o sistema se enganou.
   */
  it('o detalhe nomeia as duas razões, porque o congelado não guarda qual foi', () => {
    const detalhe = explicarSobra({ ...COMPLETA, itensComMaterialIncerto: 2 }).detalhes[0]!
    expect(detalhe, 'a razão "sem ficha" sumiu do texto').toContain('ficha do serviço')
    expect(detalhe, 'a razão "sem compra registrada" sumiu do texto').toContain('registrar a compra')
  })

  it('material conferido e taxa respondida continuam fechando a conta sem aviso', () => {
    const r = explicarSobra({ ...COMPLETA, itensComMaterialIncerto: 0 })
    expect(r.lacunas).toEqual([])
    expect(r.detalhes).toEqual([])
  })
})
