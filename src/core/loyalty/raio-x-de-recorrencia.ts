/**
 * CICLO Clube · C-03 (docs/60) — "quantos dos seus clientes já voltam rápido o bastante pra virar
 * assinante, e quanto isso valeria se X% deles assinasse?"
 *
 * Não estima adesão: mostra CENÁRIOS a percentuais fixos, para o dono decidir com o próprio
 * julgamento — o mesmo motivo de `docs/48` recusar prever taxa de acerto do Motor antes de ter
 * amostra. `ADOCOES_PADRAO` é decisão de produto (registrada em docs/60), não medição.
 */

export const LIMITE_DIAS_ELEGIVEL = 45
export const ADOCOES_PADRAO_PERCENTUAL = [10, 20, 30] as const

export type ClienteElegivel = {
  /** `client_cycles.personal_cycle_days`. */
  cicloPessoalDias: number
  /** Preço do serviço associado àquele ciclo (`services.price_cents`) — dado real, não LTV estimado. */
  ticketCents: number
}

export type CenarioDeAdocao = {
  adocaoPercentual: number
  assinantesEstimados: number
  receitaPotencialCents: number
}

export type RaioXDeRecorrencia = {
  totalElegiveis: number
  /** `null` sem ninguém elegível — não faz sentido "ticket médio de zero pessoas". */
  ticketMedioCents: number | null
  cenarios: CenarioDeAdocao[]
}

/**
 * `clientes` já vem filtrado por quem tem PELO MENOS UM serviço com ciclo ≤ `limiteDias` — filtrar
 * aqui DE NOVO seria a mesma checagem em dois lugares divergindo em silêncio se um mudar sem o
 * outro (a armadilha de "duas cópias da mesma fórmula").
 */
export function calcularRaioX(
  clientes: readonly ClienteElegivel[],
  adocoesPercentuais: readonly number[] = ADOCOES_PADRAO_PERCENTUAL,
): RaioXDeRecorrencia {
  const totalElegiveis = clientes.length

  if (totalElegiveis === 0) {
    return { totalElegiveis: 0, ticketMedioCents: null, cenarios: adocoesPercentuais.map((p) => ({ adocaoPercentual: p, assinantesEstimados: 0, receitaPotencialCents: 0 })) }
  }

  const somaTicket = clientes.reduce((soma, c) => soma + c.ticketCents, 0)
  const ticketMedioCents = Math.round(somaTicket / totalElegiveis)

  const cenarios = adocoesPercentuais.map((percentual) => {
    // Arredonda pra baixo: "quantos assinariam" não pode prometer mais gente do que a conta bate.
    const assinantesEstimados = Math.floor((totalElegiveis * percentual) / 100)
    return { adocaoPercentual: percentual, assinantesEstimados, receitaPotencialCents: assinantesEstimados * ticketMedioCents }
  })

  return { totalElegiveis, ticketMedioCents, cenarios }
}
