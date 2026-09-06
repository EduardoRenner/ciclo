/**
 * O "Sobrou" de UM atendimento, e — mais importante — o que ainda falta descontar dele.
 *
 * O `docs/48` §Fase 3 nomeia a fragilidade da tese inteira e a mitigação em uma frase: *"Estado
 * incompleto honesto, nunca número inventado"*. Um lucro por atendimento que some a comissão e
 * cale sobre o produto e a maquininha não é um número parcial — é um número **errado para cima**,
 * exibido com a mesma cara de um número completo. É o defeito que fez o quadro "Taxa" ser retirado
 * do caixa em 2026-08-28, agora um nível abaixo.
 *
 * Por isso esta função devolve duas coisas juntas, e a tela não pode mostrar uma sem a outra: o
 * valor, e a lista do que não entrou nele.
 */

export type LacunaDaSobra = 'taxa' | 'ficha'

export type EntradaDaSobra = {
  subtotalCents: number
  discountCents: number
  tipCents: number
  materialCents: number
  feeCents: number
  commissionCents: number
  /** O dono já respondeu quanto a maquininha cobra? Ver `taxaEstaConfigurada`. */
  taxaRespondida: boolean
  /** Quantos serviços desta comanda não têm ficha de consumo — o material deles não foi contado. */
  servicosSemFicha: number
  /**
   * Quantos serviços TÊM ficha e ainda assim não têm material confiável, porque pelo menos um
   * produto dela nunca teve compra registrada (`avg_cost_cents = 0`).
   *
   * Este campo existe por causa de um defeito medido em 2026-09-06: `contarServicosSemFicha`
   * respondia "0 serviços sem ficha" para o salão de cabelo cujo pack semeou a ficha inteira, e a
   * tela então mostrava o "Sobrou" SEM lacuna nenhuma — completo por fora, com o material saindo
   * de um custo que o próprio CICLO tinha inventado no cadastro. Perguntar "tem ficha?" nunca foi
   * a mesma coisa que perguntar "o material é real?", e só a segunda pergunta protege o número.
   */
  servicosComProdutoSemCusto: number
}

export type LinhaDaSobra = { rotulo: string; valorCents: number }

export type SobraExplicada = {
  sobraCents: number
  /** O que de fato entrou para o salão: subtotal menos o desconto que o dono deu. */
  receitaCents: number
  /** O que foi descontado, em ordem de leitura. Linha de valor zero fica: zero é resposta. */
  descontos: LinhaDaSobra[]
  lacunas: LacunaDaSobra[]
  /** A frase curta que a tela mostra quando há lacuna. `null` quando a conta está completa. */
  frase: string | null
  /** Uma explicação por lacuna, para a tela dizer o PORQUÊ sem espremer tudo numa frase só. */
  detalhes: string[]
}

/**
 * Frase e detalhe separados de propósito. Empilhar as duas explicações numa oração só produzia
 * *"falta descontar o produto de 2 serviços, que ainda não têm ficha de consumo e a taxa da
 * maquininha, que você ainda não informou"* — gramaticalmente válido e ilegível em 390 px. A frase
 * responde "o que falta"; os detalhes respondem "por quê", um por linha.
 */
function frasePara(lacunas: readonly LacunaDaSobra[]): string | null {
  if (lacunas.length === 0) return null

  const nomes: string[] = []
  if (lacunas.includes('ficha')) nomes.push('o produto')
  if (lacunas.includes('taxa')) nomes.push('a taxa da maquininha')

  return `Falta descontar ${nomes.join(' e ')}.`
}

/**
 * As duas causas do material incompleto viram DUAS linhas, e não uma soma. Elas pedem coisas
 * diferentes do dono: "monte a ficha" é cadastro de ofício, "registre a compra" é nota fiscal na
 * mão. Somá-las num contador só produziria "3 serviços com material incompleto" sem dizer o que
 * fazer com nenhum dos três.
 */
function detalhesPara(lacunas: readonly LacunaDaSobra[], semFicha: number, semCusto: number): string[] {
  const detalhes: string[] = []
  if (lacunas.includes('ficha')) {
    if (semFicha > 0) {
      detalhes.push(
        semFicha === 1
          ? '1 serviço desta comanda ainda não tem ficha de consumo'
          : `${semFicha} serviços desta comanda ainda não têm ficha de consumo`,
      )
    }
    if (semCusto > 0) {
      detalhes.push(
        semCusto === 1
          ? '1 serviço tem ficha, mas algum produto dela nunca teve compra registrada — ele entrou valendo zero'
          : `${semCusto} serviços têm ficha, mas algum produto delas nunca teve compra registrada — eles entraram valendo zero`,
      )
    }
  }
  if (lacunas.includes('taxa')) detalhes.push('você ainda não informou quanto a maquininha cobra')
  return detalhes
}

export function explicarSobra(entrada: EntradaDaSobra): SobraExplicada {
  const receitaCents = Math.max(0, entrada.subtotalCents - entrada.discountCents)
  const sobraCents = receitaCents - entrada.materialCents - entrada.feeCents - entrada.commissionCents

  const lacunas: LacunaDaSobra[] = []
  if (entrada.servicosSemFicha > 0 || entrada.servicosComProdutoSemCusto > 0) lacunas.push('ficha')
  /*
   * A lacuna é "não respondeu", não "vale zero". Um salão que só recebe em dinheiro e Pix responde
   * zero de propósito, e para ele a conta está completa — cobrar dele uma resposta que ele já deu
   * transformaria o aviso em ruído, e aviso que sempre aparece deixa de ser lido.
   */
  if (!entrada.taxaRespondida) lacunas.push('taxa')

  return {
    sobraCents,
    receitaCents,
    descontos: [
      { rotulo: 'Material', valorCents: entrada.materialCents },
      { rotulo: 'Taxa da maquininha', valorCents: entrada.feeCents },
      { rotulo: 'Comissão', valorCents: entrada.commissionCents },
    ],
    lacunas,
    frase: frasePara(lacunas),
    detalhes: detalhesPara(lacunas, entrada.servicosSemFicha, entrada.servicosComProdutoSemCusto),
  }
}
