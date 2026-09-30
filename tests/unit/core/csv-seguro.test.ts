import { describe, expect, it } from 'vitest'

import { protegerContraFormula } from '@/core/text/csv-seguro'

/**
 * Achado S7 da auditoria de 2026-08-23 (`importacao-clientes.ts`): um nome como
 * `=HYPERLINK(...)` vira fórmula viva quando a dona abre o CSV exportado no Excel. O guard
 * prefixa com aspas simples — o programa passa a ler como texto.
 */
describe('protegerContraFormula', () => {
  it('prefixa valor que começa com "="', () => {
    expect(protegerContraFormula('=HYPERLINK("http://mal","clique")')).toBe("'=HYPERLINK(\"http://mal\",\"clique\")")
  })

  it('prefixa os outros gatilhos de fórmula (+, -, @)', () => {
    expect(protegerContraFormula('+5511999999999')).toBe("'+5511999999999")
    expect(protegerContraFormula('-1+1')).toBe("'-1+1")
    expect(protegerContraFormula('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('nome normal não é tocado', () => {
    expect(protegerContraFormula('Ana Paula')).toBe('Ana Paula')
  })

  it('string vazia não estoura', () => {
    expect(protegerContraFormula('')).toBe('')
  })
})
