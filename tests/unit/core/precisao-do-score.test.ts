import { describe, expect, it } from 'vitest'

import { LIMIAR_ALERTA_AGENDA } from '@/core/risk/no-show-score'
import { MINIMO_PARA_AFIRMAR, precisaoDoScore, scoreSeparaQuemFalta, type DesfechoDoScore } from '@/core/risk/precisao-do-score'

/**
 * `docs/DECISOES.md` 2026-09-18: `computeNoShowScore` nunca foi medido contra falta de verdade.
 * Este arquivo prova SE o corte que já existe (`LIMIAR_ALERTA_AGENDA`) separa quem falta de quem
 * não falta — sem recalibrar peso nenhum da fórmula.
 */

function desfecho(score: number, houveFalta: boolean): DesfechoDoScore {
  return { score, houveFalta }
}

function repetir<T>(quantos: number, fabrica: () => T): T[] {
  return Array.from({ length: quantos }, fabrica)
}

describe('precisaoDoScore', () => {
  it('lista vazia: as duas taxas ficam null, nada para afirmar', () => {
    const p = precisaoDoScore([])
    expect(p.taxaDeFaltaAltoRiscoBps).toBeNull()
    expect(p.taxaDeFaltaBaixoRiscoBps).toBeNull()
    expect(p.altoRiscoConferidos).toBe(0)
    expect(p.baixoRiscoConferidos).toBe(0)
  })

  it('separa por LIMIAR_ALERTA_AGENDA — score igual ao limiar entra no lado ALTO', () => {
    const desfechos = [
      ...repetir(MINIMO_PARA_AFIRMAR, () => desfecho(LIMIAR_ALERTA_AGENDA, true)),
      ...repetir(MINIMO_PARA_AFIRMAR, () => desfecho(LIMIAR_ALERTA_AGENDA - 0.01, false)),
    ]
    const p = precisaoDoScore(desfechos)
    expect(p.altoRiscoConferidos).toBe(MINIMO_PARA_AFIRMAR)
    expect(p.taxaDeFaltaAltoRiscoBps).toBe(10_000) // 100% dos "altos" faltaram
    expect(p.taxaDeFaltaBaixoRiscoBps).toBe(0) // 0% dos "baixos" faltaram
  })

  it('amostra abaixo do piso: taxa fica null mesmo com dado real', () => {
    const desfechos = repetir(MINIMO_PARA_AFIRMAR - 1, () => desfecho(0.8, true))
    const p = precisaoDoScore(desfechos)
    expect(p.altoRiscoConferidos).toBe(MINIMO_PARA_AFIRMAR - 1)
    expect(p.taxaDeFaltaAltoRiscoBps).toBeNull()
  })

  it('exatamente o piso já afirma — o mínimo é inclusivo', () => {
    const desfechos = repetir(MINIMO_PARA_AFIRMAR, () => desfecho(0.8, true))
    const p = precisaoDoScore(desfechos)
    expect(p.taxaDeFaltaAltoRiscoBps).toBe(10_000)
  })

  it('as duas faixas contam de forma independente, sem vazar uma na outra', () => {
    const desfechos = [
      ...repetir(MINIMO_PARA_AFIRMAR, () => desfecho(0.9, true)), // alto risco, todos faltaram
      ...repetir(MINIMO_PARA_AFIRMAR, () => desfecho(0.1, false)), // baixo risco, ninguém faltou
    ]
    const p = precisaoDoScore(desfechos)
    expect(p.taxaDeFaltaAltoRiscoBps).toBe(10_000)
    expect(p.taxaDeFaltaBaixoRiscoBps).toBe(0)
  })

  it('taxa parcial arredonda em basis points', () => {
    // 3 de 8 faltaram = 37,5% = 3750 bps.
    const desfechos = [...repetir(3, () => desfecho(0.9, true)), ...repetir(5, () => desfecho(0.9, false))]
    const p = precisaoDoScore(desfechos)
    expect(p.taxaDeFaltaAltoRiscoBps).toBe(3_750)
  })
})

describe('scoreSeparaQuemFalta', () => {
  it('null quando falta amostra de qualquer um dos dois lados', () => {
    expect(scoreSeparaQuemFalta({ altoRiscoConferidos: 0, taxaDeFaltaAltoRiscoBps: null, baixoRiscoConferidos: 100, taxaDeFaltaBaixoRiscoBps: 500 })).toBeNull()
  })

  it('true quando alto risco falta mais que baixo risco — o score está funcionando', () => {
    expect(
      scoreSeparaQuemFalta({ altoRiscoConferidos: 10, taxaDeFaltaAltoRiscoBps: 6_000, baixoRiscoConferidos: 10, taxaDeFaltaBaixoRiscoBps: 1_000 }),
    ).toBe(true)
  })

  it('false quando as taxas empatam ou invertem — o score não separa nada', () => {
    expect(
      scoreSeparaQuemFalta({ altoRiscoConferidos: 10, taxaDeFaltaAltoRiscoBps: 1_000, baixoRiscoConferidos: 10, taxaDeFaltaBaixoRiscoBps: 1_000 }),
    ).toBe(false)
    expect(
      scoreSeparaQuemFalta({ altoRiscoConferidos: 10, taxaDeFaltaAltoRiscoBps: 500, baixoRiscoConferidos: 10, taxaDeFaltaBaixoRiscoBps: 2_000 }),
    ).toBe(false)
  })
})
