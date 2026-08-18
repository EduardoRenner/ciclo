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
