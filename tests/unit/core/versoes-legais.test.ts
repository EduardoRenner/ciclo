import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { dataLegivel, VERSOES_LEGAIS } from '@/core/legal/versoes'

import { semComentarios } from '../../helpers/fonte'

/**
 * BL-50: a versão que a página MOSTRA e a que o cadastro GRAVA como aceita saem da mesma constante.
 * Se a página voltar a ter a data escrita à mão, as duas divergem na próxima mudança de termos —
 * e a prova do aceite passa a apontar para uma versão que ninguém viu.
 */
describe('versões legais', () => {
  it('são datas ISO (é o que a migration 0095 aceita)', () => {
    for (const v of Object.values(VERSOES_LEGAIS)) expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('a página mostra EXATAMENTE a data que mostrava antes — o texto legal não mudou', () => {
    expect(dataLegivel(VERSOES_LEGAIS.termos)).toBe('21 de setembro de 2026')
    expect(dataLegivel(VERSOES_LEGAIS.privacidade)).toBe('16 de setembro de 2026')
  })

  it.each(['termos', 'privacidade'] as const)('/%s lê a data da fonte única, sem data escrita à mão', (doc) => {
    const fonte = semComentarios(readFileSync(`src/app/(public)/${doc}/page.tsx`, 'utf8'))
    expect(fonte).toContain(`dataLegivel(VERSOES_LEGAIS.${doc})`)
    expect(fonte, 'data legal escrita à mão na página — ela e o aceite gravado vão divergir').not.toMatch(/ATUALIZADO_EM = '\d/)
  })
})
