/**
 * A calculadora pública "quanto está parado em cliente que sumiu" — `docs/82` §8.
 *
 * As calculadoras que já existem no mercado (§2 do `docs/82`) fazem a conta genérica: "de cada 10
 * clientes, 6 a 8 não voltam". É um número de terceiro, e o dono sabe que não é o dele. Esta faz a
 * conta com três números que ELE tem, e com o ritmo de retorno no centro — que é a mesma pergunta
 * que o Motor de Ciclo responde por cliente:
 *
 *   - quantos clientes que vinham e sumiram ele consegue lembrar de cabeça;
 *   - quanto cada um costumava gastar por visita;
 *   - de quanto em quanto tempo um cliente fiel dele volta.
 *
 * Nenhum percentual inventado entra na conta. O resultado é pequeno de propósito — "só os que você
 * lembra" — porque o argumento de venda não é o tamanho do número, é a pergunta que ele deixa:
 * *e os que você não lembra?* É essa que só o produto responde, pelo nome.
 *
 * Dinheiro em centavos (regra 3). Entrada fora da faixa devolve `null` em vez de um número absurdo
 * na tela — a página mostra a conta aberta, e conta aberta com "365 ÷ 0" não é conta.
 */

export type EntradaCalculadora = {
  /** Clientes que vinham com frequência e pararam, que a pessoa lembra de cabeça. */
  clientesSumidos: number
  /** Quanto cada um gastava por visita, em centavos. */
  ticketCents: number
  /** De quanto em quanto tempo um cliente fiel volta, em dias. */
  retornoDias: number
}

export type ResultadoCalculadora = {
  /** Visitas que um cliente nesse ritmo faz num ano (365 ÷ retorno), com uma casa decimal. */
  visitasPorAno: number
  /** Quanto um cliente desses deixa por ano. */
  valorPorClientePorAnoCents: number
  paradoPorAnoCents: number
  paradoPorMesCents: number
}

export const LIMITES = {
  clientesSumidos: { min: 1, max: 500 },
  // R$ 10 mil: tatuagem, micropigmentação e harmonização passam de R$ 1.000 por sessão sem esforço.
  ticketCents: { min: 100, max: 1_000_000 },
  retornoDias: { min: 7, max: 180 },
} as const

/** Ritmos que a tela oferece como atalho. Cobrem de cílios/barba (15) a coloração (60). */
export const RITMOS_COMUNS = [15, 21, 30, 45, 60] as const

function dentro(valor: number, { min, max }: { min: number; max: number }): boolean {
  return Number.isInteger(valor) && valor >= min && valor <= max
}

export function calcularParado(entrada: EntradaCalculadora): ResultadoCalculadora | null {
  const { clientesSumidos, ticketCents, retornoDias } = entrada
  if (
    !dentro(clientesSumidos, LIMITES.clientesSumidos) ||
    !dentro(ticketCents, LIMITES.ticketCents) ||
    !dentro(retornoDias, LIMITES.retornoDias)
  ) {
    return null
  }

  // A tela mostra a conta aberta em reais inteiros ("cada cliente vale R$ 426 por ano. Vezes 8"),
  // então o total PRECISA sair dessa mesma parcela arredondada. Calcular o total direto dava
  // R$ 3.407 embaixo de "R$ 426 × 8" — um real de diferença que quem confere a conta acha, e aí
  // desconfia do resto. Medido no navegador em 2026-09-23.
  const valorPorClientePorAnoCents = Math.round((ticketCents * 365) / retornoDias / 100) * 100
  const paradoPorAnoCents = valorPorClientePorAnoCents * clientesSumidos

  return {
    visitasPorAno: Math.round((365 / retornoDias) * 10) / 10,
    valorPorClientePorAnoCents,
    paradoPorAnoCents,
    paradoPorMesCents: Math.round(paradoPorAnoCents / 12),
  }
}
