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

/**
 * Só número de verdade conta. `Number(valor)` era a armadilha: `Number(null)` e `Number('')` são
 * **0**, e `0 >= 0` passava no teste — então um `null` gravado em `settings` não caía no padrão,
 * virava zero. `Number(true)` é 1, pela mesma porta.
 *
 * Medido antes do conserto: `{ min_lead_time_minutes: null, max_advance_days: null,
 * slot_granularity_minutes: null }` devolvia `{0, 0, 0}` em vez de `{120, 60, 15}`.
 *
 * `typeof === 'number'` fecha a coerção inteira; `Number.isFinite` continua barrando `NaN` e
 * `Infinity`, que são `number` de verdade.
 */
function numeroOuPadrao(valor: unknown, padrao: number, minimo = 0): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return padrao
  return valor >= minimo ? valor : padrao
}

export function lerConfiguracoesAgenda(settings: unknown): ConfiguracoesAgenda {
  const s = (settings ?? {}) as Record<string, unknown>
  return {
    // Zero é valor legítimo nos dois primeiros: um salão pode aceitar agendamento em cima da hora
    // (`minLeadTime` 0) e, no limite, só para hoje (`maxAdvance` 0).
    minLeadTimeMinutes: numeroOuPadrao(s.min_lead_time_minutes, PADRAO.minLeadTimeMinutes),
    maxAdvanceDays: numeroOuPadrao(s.max_advance_days, PADRAO.maxAdvanceDays),
    /*
      Granularidade é o único dos três em que ZERO não é uma configuração, é uma parada: o laço de
      `core/scheduling/available-slots.ts` é `while (true)` e só sai quando o candidato passa do
      fim da janela — avançando `candidato` de `slotGranularityMin` em `slotGranularityMin`. Com
      passo 0 o candidato nunca anda, a condição de saída nunca chega, e a requisição do
      agendamento público trava prendendo CPU. Por isso o piso aqui é 1, não 0.
    */
    slotGranularityMin: numeroOuPadrao(s.slot_granularity_minutes, PADRAO.slotGranularityMin, 1),
  }
}
