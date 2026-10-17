/**
 * APR-036a (achados C-26, G-28): "quanto entrou" tem UMA conta, usada por Caixa, Mês e Hoje.
 *
 * Num cenário único (corte R$ 100, −R$ 10 de desconto, +R$ 5 de gorjeta) as telas mostravam R$ 100,
 * 95, 90 e 85, e um estorno mudava o Caixa e não a Hoje. A regra: soma o `total_cents` das
 * comandas FECHADAS ou PAGAS — o que a pessoa de fato pagou, com desconto descontado e gorjeta
 * incluída (como o Caixa já fazia; "Entrou com ou sem gorjeta" é decisão do Eduardo, `08` §10, e até
 * lá vale o que o Caixa faz). Comanda estornada (`canceled`) sai, então o estorno muda todas juntas.
 */
export type ComandaParaEntrou = { status: string; totalCents: number; paymentMethod?: string | null; closedAt?: string | null }

/**
 * APR-016b: a venda de pacote (`payments`, `kind = 'package'`) é dinheiro que entrou no dia em que
 * foi paga (`docs/DECISOES.md`, 2026-10-13 · APR-016). Venda desfeita (`refunded`) sai, como a
 * comanda estornada.
 */
export type VendaParaEntrou = { status: string; amountCents: number; paidAt?: string | null }

const CONTAM = new Set(['closed', 'paid'])

/**
 * Cada dinheiro que entrou, com o instante — a mesma lista que a soma usa, para quem precisa agrupar
 * por dia (o costume da Hoje) não ter uma segunda regra.
 *
 * Comanda paga com a forma `package` NÃO entra: o dinheiro dela entrou na venda do pacote, e contar
 * as duas coisas somaria R$ 320 + 4 × R$ 80 por um pacote de R$ 320.
 */
export function entradasDoEntrou(comandas: readonly ComandaParaEntrou[], vendas: readonly VendaParaEntrou[] = []): { cents: number; em: string | null }[] {
  return [
    ...comandas.filter((c) => CONTAM.has(c.status) && c.paymentMethod !== 'package').map((c) => ({ cents: c.totalCents, em: c.closedAt ?? null })),
    ...vendas.filter((v) => v.status === 'paid').map((v) => ({ cents: v.amountCents, em: v.paidAt ?? null })),
  ]
}

export function entrouCents(comandas: readonly ComandaParaEntrou[], vendas: readonly VendaParaEntrou[] = []): number {
  return entradasDoEntrou(comandas, vendas).reduce((soma, e) => soma + e.cents, 0)
}

/**
 * A Hoje mostra "Entrou" quando o negócio usa comanda e "Atendido" (preço de tabela dos
 * atendimentos concluídos) quando não usa — salão que só marca "concluído" veria sempre R$ 0,00 no
 * lugar do dia de trabalho. "Usa comanda" = abriu alguma nas últimas semanas.
 */
export function numeroDoDia(entrada: { usaComanda: boolean; entrouHojeCents: number; atendidoHojeCents: number }): { rotulo: 'Entrou hoje' | 'Atendido hoje'; cents: number } {
  return entrada.usaComanda ? { rotulo: 'Entrou hoje', cents: entrada.entrouHojeCents } : { rotulo: 'Atendido hoje', cents: entrada.atendidoHojeCents }
}
