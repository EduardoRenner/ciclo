import { describe, expect, it } from 'vitest'

import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'

/**
 * `tenants.settings` é jsonb livre: nada no banco garante o TIPO do que está lá dentro. Esta
 * função é a única fronteira entre esse jsonb e o gerador de horários — o que ela deixar passar,
 * `core/scheduling/available-slots.ts` obedece.
 *
 * O defeito era a coerção do `Number()`: `Number(null)` e `Number('')` valem **0**, e o teste
 * antigo (`n >= 0`) aprovava. Um `null` gravado em `settings` não caía no padrão, virava zero.
 *
 * E zero não custa igual nos três campos. É configuração legítima em dois deles e uma PARADA no
 * terceiro — daí este arquivo existir.
 */
describe('só número de verdade vira configuração', () => {
  it('ausente cai no padrão', () => {
    expect(lerConfiguracoesAgenda({})).toEqual({ minLeadTimeMinutes: 120, maxAdvanceDays: 60, slotGranularityMin: 15 })
    expect(lerConfiguracoesAgenda(null)).toEqual({ minLeadTimeMinutes: 120, maxAdvanceDays: 60, slotGranularityMin: 15 })
  })

  it('número de verdade é respeitado', () => {
    expect(
      lerConfiguracoesAgenda({ min_lead_time_minutes: 30, max_advance_days: 90, slot_granularity_minutes: 20 }),
    ).toEqual({ minLeadTimeMinutes: 30, maxAdvanceDays: 90, slotGranularityMin: 20 })
  })

  it('`null` e string vazia caem no padrão — não viram zero', () => {
    /*
     * O defeito medido. `Number(null) === 0` e `Number('') === 0`, e `0 >= 0` passava: os três
     * campos vinham zerados de um valor que só queria dizer "não configurado".
     */
    const nulos = { min_lead_time_minutes: null, max_advance_days: null, slot_granularity_minutes: null }
    const vazios = { min_lead_time_minutes: '', max_advance_days: '', slot_granularity_minutes: '' }
    for (const entrada of [nulos, vazios]) {
      expect(lerConfiguracoesAgenda(entrada)).toEqual({ minLeadTimeMinutes: 120, maxAdvanceDays: 60, slotGranularityMin: 15 })
    }
  })

  it('booleano e array não viram número pela porta dos fundos', () => {
    // `Number(true) === 1` e `Number([]) === 0` — as duas outras coerções que o `Number()` abria.
    expect(lerConfiguracoesAgenda({ slot_granularity_minutes: true }).slotGranularityMin).toBe(15)
    expect(lerConfiguracoesAgenda({ slot_granularity_minutes: [] }).slotGranularityMin).toBe(15)
    expect(lerConfiguracoesAgenda({ min_lead_time_minutes: '30' }).minLeadTimeMinutes).toBe(120)
  })

  it('zero é configuração legítima na antecedência, mas nunca na granularidade', () => {
    /*
     * A distinção que dá razão a este arquivo. Um salão PODE aceitar agendamento em cima da hora
     * (`minLeadTime` 0) e, no limite, só para hoje (`maxAdvance` 0) — são escolhas.
     *
     * Granularidade 0 não é escolha, é parada: o laço de `available-slots.ts` é `while (true)` e
     * sai quando o candidato passa do fim da janela, avançando de `slotGranularityMin` em
     * `slotGranularityMin`. Com passo 0 o candidato nunca anda, a saída nunca chega, e a
     * requisição do agendamento público trava prendendo CPU. Por isso o piso é 1.
     */
    expect(lerConfiguracoesAgenda({ min_lead_time_minutes: 0 }).minLeadTimeMinutes).toBe(0)
    expect(lerConfiguracoesAgenda({ max_advance_days: 0 }).maxAdvanceDays).toBe(0)
    expect(lerConfiguracoesAgenda({ slot_granularity_minutes: 0 }).slotGranularityMin).toBe(15)
  })

  it('negativo cai no padrão nos três', () => {
    expect(
      lerConfiguracoesAgenda({ min_lead_time_minutes: -1, max_advance_days: -5, slot_granularity_minutes: -15 }),
    ).toEqual({ minLeadTimeMinutes: 120, maxAdvanceDays: 60, slotGranularityMin: 15 })
  })

  it('NaN e Infinity são `number` e mesmo assim não passam', () => {
    // `typeof NaN === 'number'` — sem o `Number.isFinite` a troca de coerção teria aberto um buraco novo.
    expect(lerConfiguracoesAgenda({ slot_granularity_minutes: Number.NaN }).slotGranularityMin).toBe(15)
    expect(lerConfiguracoesAgenda({ max_advance_days: Number.POSITIVE_INFINITY }).maxAdvanceDays).toBe(60)
  })
})
