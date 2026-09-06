import { describe, expect, it } from 'vitest'

import { acoesDeCompletude } from '@/core/comanda/completude-do-lucro'

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
}

const chaves = (e: Parameters<typeof acoesDeCompletude>[0]) => acoesDeCompletude(e).map((a) => a.chave)

describe('acoesDeCompletude — a pergunta some quando é respondida', () => {
  it('conta que não sabe nada pergunta as duas coisas', () => {
    expect(chaves(TUDO_FALTANDO)).toEqual(['completude-taxa', 'completude-material'])
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
      acoesDeCompletude({ podeVerLucro: true, taxaRespondida: true, servicosSemFicha: 0, servicosComProdutoSemCusto: 0 }),
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
})
