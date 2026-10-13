/**
 * APR-036a (achados C-26, G-28): "quanto entrou" tem UMA conta, usada por Caixa, Mês e Hoje.
 *
 * Num cenário único (corte R$ 100, −R$ 10 de desconto, +R$ 5 de gorjeta) as telas mostravam R$ 100,
 * 95, 90 e 85, e um estorno mudava o Caixa e não a Hoje. A regra: soma o `total_cents` das
 * comandas FECHADAS ou PAGAS — o que a pessoa de fato pagou, com desconto descontado e gorjeta
 * incluída (como o Caixa já fazia; "Entrou com ou sem gorjeta" é decisão do Eduardo, `08` §10, e até
 * lá vale o que o Caixa faz). Comanda estornada (`canceled`) sai, então o estorno muda todas juntas.
 */
export type ComandaParaEntrou = { status: string; totalCents: number }

const CONTAM = new Set(['closed', 'paid'])

export function entrouCents(comandas: readonly ComandaParaEntrou[]): number {
  return comandas.reduce((soma, c) => (CONTAM.has(c.status) ? soma + c.totalCents : soma), 0)
}

/**
 * A Hoje mostra "Entrou" quando o negócio usa comanda e "Atendido" (preço de tabela dos
 * atendimentos concluídos) quando não usa — salão que só marca "concluído" veria sempre R$ 0,00 no
 * lugar do dia de trabalho. "Usa comanda" = abriu alguma nas últimas semanas.
 */
export function numeroDoDia(entrada: { usaComanda: boolean; entrouHojeCents: number; atendidoHojeCents: number }): { rotulo: 'Entrou hoje' | 'Atendido hoje'; cents: number } {
  return entrada.usaComanda ? { rotulo: 'Entrou hoje', cents: entrada.entrouHojeCents } : { rotulo: 'Atendido hoje', cents: entrada.atendidoHojeCents }
}
