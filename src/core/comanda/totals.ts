/**
 * `01-ESPEC-TECNICA §5.7`. Tudo em centavos, `Math.round` em toda multiplicação — `qty` é
 * decimal (produto vendido em ml/g), então `qty × unitPriceCents` quase nunca cai num inteiro
 * exato sozinho; arredondar cedo, uma vez por linha, é o que garante que a soma das linhas bate
 * com o total do jeito que o critério de aceite do TICKET-042 pede.
 */
export type EntradaTotalItem = {
  qty: number
  unitPriceCents: number
  discountCents: number
}

export function calcularTotalItem(entrada: EntradaTotalItem): number {
  const bruto = Math.round(entrada.qty * entrada.unitPriceCents)
  return Math.max(0, bruto - entrada.discountCents)
}

export type BaseComissao = 'gross' | 'net_of_material'

export type EntradaComissaoItem = {
  totalCents: number
  costCents: number
  commissionBps: number
  commissionBase: BaseComissao
}

/** §5.7: `comissao = round(base × percentual)`, base bruta ou líquida de material conforme `tenant_settings.commission_base`. */
export function calcularComissaoItem(entrada: EntradaComissaoItem): number {
  const base = entrada.commissionBase === 'net_of_material' ? Math.max(0, entrada.totalCents - entrada.costCents) : entrada.totalCents
  return Math.round((base * entrada.commissionBps) / 10_000)
}

export type ItemParaTotais = { totalCents: number }

export type EntradaTotaisComanda = {
  items: ItemParaTotais[]
  discountCents: number
  tipCents: number
}

export type ResultadoTotaisComanda = {
  subtotalCents: number
  totalCents: number
}

/**
 * F84: gorjeta é 100% do profissional, não entra em base de comissão nem de receita — mas ENTRA
 * no valor que a cliente paga (`total`), por isso soma aqui em vez de só aparecer separada.
 */
export function calcularTotaisComanda(entrada: EntradaTotaisComanda): ResultadoTotaisComanda {
  const subtotalCents = entrada.items.reduce((soma, item) => soma + item.totalCents, 0)
  const totalCents = Math.max(0, subtotalCents - entrada.discountCents) + entrada.tipCents
  return { subtotalCents, totalCents }
}

export type EntradaFechamento = {
  subtotalCents: number
  discountCents: number
  tipCents: number
  materialCents: number
  feeCents: number
  commissionCents: number
  /**
   * O custo da hora de cadeira que este atendimento ocupou (`0072`).
   *
   * Sem ele a conta era margem de contribuição com nome de lucro: um corte de R$ 45 com 40% de
   * comissão "sobrava" R$ 24,00 para um dono que paga R$ 3.500 de aluguel. Zero quando o dono
   * ainda não respondeu as três perguntas — e nesse caso quem avisa é a lacuna da tela, nunca o
   * número.
   */
  fixedCostCents: number
}

/**
 * O que sobra para o salão quando a comanda fecha.
 *
 * A tela do caixa diz, com estas palavras: *"Sobrou — o que entrou menos material, taxa da
 * maquininha e comissão"*. Até esta auditoria a conta guardada em `tickets.profit_cents` era
 * `subtotal − material − comissão`, ignorando o desconto e a gorjeta do nível da comanda. As duas
 * pontas discordavam justamente onde dói:
 *
 *   - **desconto**: numa comanda de R$ 100 com R$ 20 de desconto, "Entrou" mostrava R$ 80 e
 *     "Sobrou" mostrava R$ 100 — sobrava mais do que entrou. O desconto é dinheiro que o salão
 *     abriu mão de receber, e saía do relatório de graça;
 *   - **gorjeta**: entra no `total` (a cliente paga) e é 100% do profissional (F84) — então tem
 *     que sair de novo aqui, ou vira lucro que o salão nunca viu.
 *
 * A comissão continua calculada sobre o total do item, sem o desconto da comanda: o desconto é
 * concessão do dono, não do profissional. Por isso ele aparece inteiro aqui, na linha do salão.
 */
export function calcularSobraDaComanda(entrada: EntradaFechamento): number {
  const receitaDoSalao = Math.max(0, entrada.subtotalCents - entrada.discountCents)
  return receitaDoSalao - entrada.materialCents - entrada.feeCents - entrada.commissionCents - entrada.fixedCostCents
}
