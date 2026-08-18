/**
 * `tenants.settings` é jsonb livre (D51-style) — sem coluna própria para
 * antecedência mínima/máxima. E60/E61/E62 dão os padrões; esta função só
 * lê o que o tenant sobrescreveu, com esses padrões por trás.
 */
export type ConfiguracoesAgenda = {
  minLeadTimeMinutes: number
  maxAdvanceDays: number
  slotGranularityMin: number
}

const PADRAO: ConfiguracoesAgenda = {
  minLeadTimeMinutes: 120,
  maxAdvanceDays: 60,
  slotGranularityMin: 15,
}

function numeroOuPadrao(valor: unknown, padrao: number): number {
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 ? n : padrao
}

export function lerConfiguracoesAgenda(settings: unknown): ConfiguracoesAgenda {
  const s = (settings ?? {}) as Record<string, unknown>
  return {
    minLeadTimeMinutes: numeroOuPadrao(s.min_lead_time_minutes, PADRAO.minLeadTimeMinutes),
    maxAdvanceDays: numeroOuPadrao(s.max_advance_days, PADRAO.maxAdvanceDays),
    slotGranularityMin: numeroOuPadrao(s.slot_granularity_minutes, PADRAO.slotGranularityMin),
  }
}
