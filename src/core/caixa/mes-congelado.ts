/**
 * APR-211 (docs/98 E-14): a conta do mês congelado tem que fechar pela própria tabela:
 * receita − material − taxa − comissão − aluguel rateado = lucro. Antes faltava o aluguel na tabela
 * (o lucro já vinha com ele descontado) e a soma das partes nunca dava o lucro — quem conferisse
 * `monthly_profit` numa planilha achava um buraco sem nome.
 */
export type PartesDoMes = {
  revenueCents: number
  materialCents: number
  feeCents: number
  commissionCents: number
  fixedCostCents: number
  profitCents: number
}

export function lucroPelasPartes(m: Omit<PartesDoMes, 'profitCents'>): number {
  return m.revenueCents - m.materialCents - m.feeCents - m.commissionCents - m.fixedCostCents
}

export function contaDoMesFecha(m: PartesDoMes): boolean {
  return lucroPelasPartes(m) === m.profitCents
}
