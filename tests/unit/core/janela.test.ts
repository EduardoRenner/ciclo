import { describe, expect, it } from 'vitest'

import { dataLocalDe, horaLocalDe } from '@/core/cron/janela'

/**
 * `dentroDaJanela` já é exercitada em `tests/unit/server/cron-sobrevive-a-atraso.test.ts`.
 * O que faltava teste era o par de wrappers de `Intl` — `horaLocalDe` e `dataLocalDe` —, e é
 * neles que moram as duas armadilhas que o comentário do arquivo descreve mas nada media:
 *
 *   1. sem `hourCycle: 'h23'`, meia-noite volta como "24" em alguns locales e a comparação com
 *      o alvo (`horaLocal === 3`) erra em silêncio;
 *   2. a hora/data tem que ser a do FUSO DO TENANT, nunca a de UTC — a rota de cron decide quem
 *      processar por essa conta.
 */

// 2026-03-15T02:30:00Z — de propósito depois da meia-noite UTC e antes dela em todo fuso do
// Brasil, para que a data local NÃO coincida com a data UTC.
const VIRADA = new Date('2026-03-15T02:30:00Z')

describe('horaLocalDe', () => {
  it('devolve a hora do fuso do tenant, não a de UTC', () => {
    expect(horaLocalDe('America/Sao_Paulo', VIRADA)).toBe(23) // UTC-3
    expect(horaLocalDe('America/Noronha', VIRADA)).toBe(0) // UTC-2
    expect(horaLocalDe('America/Manaus', VIRADA)).toBe(22) // UTC-4
    expect(horaLocalDe('America/Rio_Branco', VIRADA)).toBe(21) // UTC-5
  })

  it('meia-noite é 0, nunca 24 (a armadilha do hourCycle)', () => {
    // 03:00Z = 00:00 em São Paulo (UTC-3).
    expect(horaLocalDe('America/Sao_Paulo', new Date('2026-06-01T03:00:00Z'))).toBe(0)
  })

  it('está sempre entre 0 e 23', () => {
    for (let h = 0; h < 24; h++) {
      const instante = new Date(`2026-06-10T${String(h).padStart(2, '0')}:00:00Z`)
      const local = horaLocalDe('America/Sao_Paulo', instante)
      expect(local).toBeGreaterThanOrEqual(0)
      expect(local).toBeLessThanOrEqual(23)
    }
  })
})

describe('dataLocalDe', () => {
  it('devolve YYYY-MM-DD do fuso do tenant', () => {
    // Em todo fuso do Brasil, 02:30Z de 15/03 ainda é 14/03 local.
    expect(dataLocalDe('America/Sao_Paulo', VIRADA)).toBe('2026-03-14')
    expect(dataLocalDe('America/Noronha', VIRADA)).toBe('2026-03-15') // UTC-2: já virou
    expect(dataLocalDe('America/Rio_Branco', VIRADA)).toBe('2026-03-14')
  })

  it('não usa a data de UTC', () => {
    // 23:30Z de 31/12 — em São Paulo ainda é 20:30 do dia 31; a diferença só apareceria
    // se a função caísse para UTC num fuso mais a leste.
    const reveillon = new Date('2026-12-31T23:30:00Z')
    expect(dataLocalDe('America/Sao_Paulo', reveillon)).toBe('2026-12-31')
  })
})
