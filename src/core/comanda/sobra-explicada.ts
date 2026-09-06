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

function detalhesPara(lacunas: readonly LacunaDaSobra[], servicosSemFicha: number): string[] {
  const detalhes: string[] = []
  if (lacunas.includes('ficha')) {
    detalhes.push(
      servicosSemFicha === 1
        ? '1 serviço desta comanda ainda não tem ficha de consumo'
        : `${servicosSemFicha} serviços desta comanda ainda não têm ficha de consumo`,
    )
  }
  if (lacunas.includes('taxa')) detalhes.push('você ainda não informou quanto a maquininha cobra')
  return detalhes
}

export function explicarSobra(entrada: EntradaDaSobra): SobraExplicada {
  const receitaCents = Math.max(0, entrada.subtotalCents - entrada.discountCents)
  const sobraCents = receitaCents - entrada.materialCents - entrada.feeCents - entrada.commissionCents

  const lacunas: LacunaDaSobra[] = []
  if (entrada.servicosSemFicha > 0) lacunas.push('ficha')
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
    detalhes: detalhesPara(lacunas, entrada.servicosSemFicha),
  }
}
