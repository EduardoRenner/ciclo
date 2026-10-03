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

  /*
    A data é FIXADA aqui para que mudar a versão legal seja um ato deliberado: quem muda o texto de
    `/termos` ou `/privacidade` troca a constante E esta linha no mesmo commit, e o revisor vê as
    duas. Termos: 03/10/2026, §5 e §6 reescritos para o período de uso sem cobrança e os dois planos
    (docs/87). Antes: 21/09/2026.
  */
  it('a versão em vigor é a que este teste conhece: mudar o texto legal exige mudar a data aqui, de propósito', () => {
    expect(dataLegivel(VERSOES_LEGAIS.termos)).toBe('3 de outubro de 2026')
    expect(dataLegivel(VERSOES_LEGAIS.privacidade)).toBe('16 de setembro de 2026')
  })

  it.each(['termos', 'privacidade'] as const)('/%s lê a data da fonte única, sem data escrita à mão', (doc) => {
    const fonte = semComentarios(readFileSync(`src/app/(public)/${doc}/page.tsx`, 'utf8'))
    expect(fonte).toContain(`dataLegivel(VERSOES_LEGAIS.${doc})`)
    expect(fonte, 'data legal escrita à mão na página — ela e o aceite gravado vão divergir').not.toMatch(/ATUALIZADO_EM = '\d/)
  })
})
