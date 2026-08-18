/**
 * §5.6/F82: média móvel ponderada, não FIFO ("complexidade sem retorno" no MVP). Cada entrada de
 * estoque recalcula o custo médio do produto inteiro — puro porque o cálculo em si não depende
 * de nada além dos quatro números.
 */
export type EntradaMediaMovel = {
  estoqueAtualQty: number
  custoMedioAtualCents: number
  qtyEntrada: number
  custoUnitarioEntradaCents: number
}

export function calcularNovoCustoMedio(entrada: EntradaMediaMovel): number {
  const estoqueFinal = entrada.estoqueAtualQty + entrada.qtyEntrada
  if (estoqueFinal <= 0) return entrada.custoUnitarioEntradaCents

  const valorAtual = entrada.estoqueAtualQty * entrada.custoMedioAtualCents
  const valorEntrada = entrada.qtyEntrada * entrada.custoUnitarioEntradaCents
  return Math.round((valorAtual + valorEntrada) / estoqueFinal)
}
