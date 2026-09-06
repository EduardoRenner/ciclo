import { describe, expect, it } from 'vitest'

import { CATALOGO_DE_SERVICOS, acoesDeCompletude, destinoDoMaterial } from '@/core/comanda/completude-do-lucro'

/**
 * O card que pede o dado do lucro tem que SUMIR quando o dado é dado — inclusive quando a resposta
 * é zero. É o `docs/50` §3.1, e a razão não é estética: esta base já deixou o `/api/health`
 * devolvendo 503 por meses sem ninguém olhar. Alarme que sempre toca deixa de ser lido, e um card
 * de completude que nunca some transforma a Central de Ações inteira em papel de parede.
 *
 * Esta guarda chama a MESMA função que `centralDeAcoes` chama. A primeira versão da guarda irmã
 * (card "perto do prêmio") espelhou a fórmula dentro do arquivo de teste, provou que a conta é
 * proporcional e não que o produto a usa — e passou verde com o defeito reintroduzido em `crm.ts`.
 */

const TUDO_FALTANDO = {
  podeVerLucro: true,
  taxaRespondida: false,
  servicosSemFicha: 2,
  servicosComProdutoSemCusto: 1,
  custoFixoRespondido: false,
}

const chaves = (e: Parameters<typeof acoesDeCompletude>[0]) => acoesDeCompletude(e).map((a) => a.chave)

describe('acoesDeCompletude — a pergunta some quando é respondida', () => {
  it('conta que não sabe nada pergunta as duas coisas', () => {
    expect(chaves(TUDO_FALTANDO)).toEqual(['completude-taxa', 'completude-custo-fixo', 'completude-material'])
  })

  /**
   * O caso que define o ticket. Salão de dinheiro e Pix responde ZERO nas cinco formas de
   * propósito — e para ele o assunto acabou. `taxaEstaConfigurada` separa "respondeu zero" de
   * "nunca respondeu" justamente aqui; se esta asserção cair, o card virou ruído permanente para
   * quem fez tudo certo.
   */
  it('taxa respondida — inclusive respondida com zero — nunca mais é perguntada', () => {
    expect(chaves({ ...TUDO_FALTANDO, taxaRespondida: true })).not.toContain('completude-taxa')
  })

  it('material completo nunca mais é perguntado', () => {
    expect(chaves({ ...TUDO_FALTANDO, servicosSemFicha: 0, servicosComProdutoSemCusto: 0 })).not.toContain('completude-material')
  })

  it('as duas respondidas não deixam card nenhum para trás', () => {
    expect(
      acoesDeCompletude({ podeVerLucro: true, taxaRespondida: true, custoFixoRespondido: true, servicosSemFicha: 0, servicosComProdutoSemCusto: 0 }),
      'card que sobrevive à resposta é o alarme que ninguém lê',
    ).toEqual([])
  })

  /**
   * As duas causas do material incompleto contam para o mesmo card, e as duas precisam contar. A
   * segunda é a que a 0069 destravou: ficha semeada pelo pack existe, então `servicosSemFicha` é
   * zero, e sem somar `comProdutoSemCusto` o dono nunca seria avisado de que o material dele é
   * um custo que ninguém registrou.
   */
  it('ficha semeada pelo pack, sem compra registrada, também pede resposta', () => {
    const so = acoesDeCompletude({ ...TUDO_FALTANDO, servicosSemFicha: 0, servicosComProdutoSemCusto: 3 })
    const material = so.find((a) => a.chave === 'completude-material')
    expect(material, 'serviço com ficha e sem custo real ficou invisível').toBeDefined()
    expect(material!.titulo).toBe('3 serviços ainda não descontam o produto')
  })

  it('soma as duas causas num card só, com o singular certo', () => {
    const uma = acoesDeCompletude({ ...TUDO_FALTANDO, servicosSemFicha: 1, servicosComProdutoSemCusto: 0 })
    expect(uma.find((a) => a.chave === 'completude-material')!.titulo).toBe('1 serviço ainda não desconta o produto')

    const tres = acoesDeCompletude({ ...TUDO_FALTANDO, servicosSemFicha: 2, servicosComProdutoSemCusto: 1 })
    expect(tres.find((a) => a.chave === 'completude-material')!.titulo).toBe('3 serviços ainda não descontam o produto')
  })

  /**
   * Dinheiro do negócio. O profissional comissionado abre a comanda (`comanda:own`) e a trava de
   * `report:read` esconde dele o "Sobrou"; a Central de Ações não pode ser a porta dos fundos que
   * conta a mesma coisa em outra tela.
   */
  it('sem report:read não sai ação nenhuma, nem quando falta tudo', () => {
    expect(acoesDeCompletude({ ...TUDO_FALTANDO, podeVerLucro: false })).toEqual([])
  })

  /**
   * A terceira pergunta, de 2026-09-06. Sem ela o "Sobrou" era margem de contribuição com nome de
   * lucro: um corte de R$ 45 com 40% de comissão dizia "Sobrou R$ 24,00" para um dono que paga
   * R$ 3.500 de aluguel.
   */
  it('o aluguel entra na fila de perguntas, e some quando respondido', () => {
    expect(chaves(TUDO_FALTANDO)).toContain('completude-custo-fixo')
    expect(chaves({ ...TUDO_FALTANDO, custoFixoRespondido: true })).not.toContain('completude-custo-fixo')
  })

  /** Quem atende em casa responde zero de propósito, e para ele o assunto acabou. */
  it('custo fixo respondido com zero nunca mais é perguntado', () => {
    const respondido = acoesDeCompletude({ ...TUDO_FALTANDO, custoFixoRespondido: true, taxaRespondida: true, servicosSemFicha: 0, servicosComProdutoSemCusto: 0 })
    expect(respondido).toEqual([])
  })
})

/**
 * `docs/50` L-02: a faixa da comanda já dizia o que falta desde a `I-01`. O que faltava era ela
 * custar UM TOQUE — hoje ela despejava o dono na lista inteira do catálogo para ele procurar qual
 * dos serviços daquela comanda estava sem custo.
 */
describe('destinoDoMaterial — a faixa leva à resposta, não ao catálogo', () => {
  it('um serviço incerto leva à ficha DELE', () => {
    expect(destinoDoMaterial(['abc-123'])).toBe('/admin/config/servicos/abc-123/ficha')
  })

  /**
   * Com vários, a lista. Mandar para a ficha do primeiro esconderia os outros dois, e o dono
   * voltaria da tela achando que resolveu — pior que a caçada, porque a caçada ao menos não mente.
   */
  it('vários serviços incertos levam ao catálogo, e não ao primeiro deles', () => {
    const destino = destinoDoMaterial(['abc-123', 'def-456', 'ghi-789'])
    expect(destino).toBe(CATALOGO_DE_SERVICOS)
    expect(destino, 'levar ao primeiro esconde os outros').not.toContain('abc-123')
  })

  it('nenhum serviço incerto ainda devolve um destino válido, e não null', () => {
    expect(destinoDoMaterial([])).toBe(CATALOGO_DE_SERVICOS)
  })
})
