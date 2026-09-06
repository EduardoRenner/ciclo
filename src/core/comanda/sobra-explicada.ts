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

export type LacunaDaSobra = 'taxa' | 'ficha' | 'custo-fixo'

export type EntradaDaSobra = {
  subtotalCents: number
  discountCents: number
  tipCents: number
  materialCents: number
  feeCents: number
  commissionCents: number
  /** A hora de cadeira que este atendimento ocupou (`0072`). */
  fixedCostCents: number
  /**
   * O dono já respondeu quanto sai por mês, quantas horas abre e quantas cadeiras tem? Ver
   * `custoFixoEstaConfigurado` — e, como na taxa, "respondeu zero" não é "nunca respondeu": quem
   * atende em casa responde zero de propósito e para ele a conta está completa.
   */
  custoFixoRespondido: boolean
  /** O dono já respondeu quanto a maquininha cobra? Ver `taxaEstaConfigurada`. */
  taxaRespondida: boolean
  /**
   * Quantos ITENS desta comanda entraram com um custo de material que não era o custo de verdade —
   * `ticket_items.material_incerto`, congelado no lançamento de cada item (`0070`).
   *
   * Item, e não serviço, porque é o item que carrega o `cost_cents` congelado. E uma contagem só,
   * sem separar as duas razões (serviço sem ficha × produto sem compra registrada), porque o
   * registro não guarda qual delas era — e saber a razão de um estado que já passou não muda ação
   * nenhuma do dono hoje. Quem precisa da razão é o catálogo, onde ela ainda é resolvível, e lá
   * `medirMaterialIncerto` continua respondendo as duas.
   *
   * Até 2026-09-06 este número era MEDIDO na abertura da tela, sobre o catálogo de hoje. A comanda
   * de agosto parava de avisar assim que o dono registrasse a compra em outubro, e o
   * `material_cost_cents` dela continuava zero: o número errado ficava e o aviso sumia.
   */
  itensComMaterialIncerto: number
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
  if (lacunas.includes('custo-fixo')) nomes.push('o aluguel')

  /*
   * Com três, a vírgula antes do "e" — "o produto, a taxa da maquininha e o aluguel". Sem isso a
   * frase vira uma enumeração com dois "e" e fica ilegível em 390 px, que é o mesmo motivo pelo
   * qual frase e detalhe são separados aqui.
   */
  const ultimo = nomes.pop()!
  return nomes.length === 0 ? `Falta descontar ${ultimo}.` : `Falta descontar ${nomes.join(', ')} e ${ultimo}.`
}

/**
 * As duas causas do material incompleto viram DUAS linhas, e não uma soma. Elas pedem coisas
 * diferentes do dono: "monte a ficha" é cadastro de ofício, "registre a compra" é nota fiscal na
 * mão. Somá-las num contador só produziria "3 serviços com material incompleto" sem dizer o que
 * fazer com nenhum dos três.
 */
function detalhesPara(lacunas: readonly LacunaDaSobra[], itens: number): string[] {
  const detalhes: string[] = []
  if (lacunas.includes('ficha')) {
    detalhes.push(
      itens === 1
        ? '1 item entrou sem o custo real do produto: falta a ficha do serviço, ou falta registrar a compra do insumo'
        : `${itens} itens entraram sem o custo real do produto: falta a ficha do serviço, ou falta registrar a compra do insumo`,
    )
  }
  if (lacunas.includes('taxa')) detalhes.push('você ainda não informou quanto a maquininha cobra')
  if (lacunas.includes('custo-fixo')) {
    detalhes.push('o aluguel e as contas não entram nesta conta: falta dizer quanto sai por mês, quantas horas você abre e quantas cadeiras tem')
  }
  return detalhes
}

export function explicarSobra(entrada: EntradaDaSobra): SobraExplicada {
  const receitaCents = Math.max(0, entrada.subtotalCents - entrada.discountCents)
  const sobraCents = receitaCents - entrada.materialCents - entrada.feeCents - entrada.commissionCents - entrada.fixedCostCents

  const lacunas: LacunaDaSobra[] = []
  if (entrada.itensComMaterialIncerto > 0) lacunas.push('ficha')
  /*
   * A lacuna é "não respondeu", não "vale zero". Um salão que só recebe em dinheiro e Pix responde
   * zero de propósito, e para ele a conta está completa — cobrar dele uma resposta que ele já deu
   * transformaria o aviso em ruído, e aviso que sempre aparece deixa de ser lido.
   */
  if (!entrada.taxaRespondida) lacunas.push('taxa')
  /*
   * Sem esta lacuna o "Sobrou" era margem de contribuição com nome de lucro — um corte de R$ 45 com
   * 40% de comissão "sobrava" R$ 24,00 para quem paga R$ 3.500 de aluguel. O `docs/47` P05 acusa o
   * setor de mostrar faturamento com cara de lucro; era a mesma família, um degrau acima, dentro do
   * produto que faz a acusação.
   */
  if (!entrada.custoFixoRespondido) lacunas.push('custo-fixo')

  return {
    sobraCents,
    receitaCents,
    descontos: [
      { rotulo: 'Material', valorCents: entrada.materialCents },
      { rotulo: 'Taxa da maquininha', valorCents: entrada.feeCents },
      { rotulo: 'Comissão', valorCents: entrada.commissionCents },
      { rotulo: 'Aluguel e contas', valorCents: entrada.fixedCostCents },
    ],
    lacunas,
    frase: frasePara(lacunas),
    detalhes: detalhesPara(lacunas, entrada.itensComMaterialIncerto),
  }
}
