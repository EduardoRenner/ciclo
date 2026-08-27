import { describe, expect, it } from 'vitest'

import { ROTAS_AGENDADAS, heartbeatVigiado, rodaSozinha } from '@/core/cron/agendadas'

/**
 * `heartbeatVigiado` é o que decide se o `/api/health` cobra execução recente de um job de cron.
 * Errar aqui devolve o produto ao "falso verde": ou alarme permanente por um job desligado de
 * propósito (`reminders`), ou silêncio no dia em que o Motor de Ciclo parar.
 *
 * `saude-vigia-so-o-que-roda.test.ts` exercita isto por dentro do `verificarSaude`; falta o
 * teste direto dos três ramos da decisão.
 */

describe('rodaSozinha', () => {
  it('só é verdade para rota que está em ROTAS_AGENDADAS', () => {
    expect(rodaSozinha('recompute-cycles')).toBe(true)
    expect(rodaSozinha('segments')).toBe(true)
    expect(rodaSozinha('reminders')).toBe(false)
    expect(rodaSozinha('campaigns')).toBe(false)
  })

  it('concorda com a lista ROTAS_AGENDADAS em toda entrada', () => {
    for (const rota of ROTAS_AGENDADAS) expect(rodaSozinha(rota)).toBe(true)
  })
})

describe('heartbeatVigiado', () => {
  it('kind desconhecido é vigiado — o padrão seguro é alarmar', () => {
    expect(heartbeatVigiado('um_kind_que_ninguem_mapeou')).toBe(true)
  })

  it('kind de rota agendada é vigiado', () => {
    // recompute_cycles → recompute-cycles, que está no schedule do cron.yml.
    expect(heartbeatVigiado('recompute_cycles')).toBe(true)
  })

  it('kind de rota que NÃO roda sozinha não é vigiado', () => {
    // send_reminders → reminders, deliberadamente fora do schedule (manda mensagem a cliente final).
    expect(heartbeatVigiado('send_reminders')).toBe(false)
    // send_campaigns → campaigns, mesma situação.
    expect(heartbeatVigiado('send_campaigns')).toBe(false)
  })
})
