import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils'

/**
 * O `tailwind-merge` não conhece a escala do CICLO e classificava `text-corpo`
 * & cia. como cor — apagando o tamanho da fonte sempre que uma cor de texto
 * vinha depois na mesma chamada. Era invisível: a tela ficava "quase certa".
 * Este arquivo existe para que um nome novo na escala sem registro em
 * `src/lib/utils.ts` reprove o build em vez de sumir na tela.
 */
const ESCALA = ['numero', 'titulo', 'stat', 'corpo', 'secundario', 'label', 'overline'] as const

describe('cn() e a escala tipográfica', () => {
  it.each(ESCALA)('text-%s sobrevive a uma cor de texto declarada depois', (nome) => {
    const saida = cn(`text-${nome} font-semibold`, 'text-acc-2')
    expect(saida).toContain(`text-${nome}`)
    expect(saida).toContain('text-acc-2')
  })

  it('dois tamanhos da escala ainda conflitam entre si — o último vence', () => {
    expect(cn('text-corpo', 'text-titulo')).toBe('text-titulo')
  })

  it('a escala não atropela o conflito de cor de texto', () => {
    expect(cn('text-txt-2', 'text-acc-2')).toBe('text-acc-2')
  })

  it('continua desfazendo conflito comum de Tailwind', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })
})
