import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * A página pública do negócio (`(public)/[slug]/layout.tsx`) é clara desde 2026-09-21. O acento
 * dela vem do tenant, e o osso de fábrica (#f0ebe3) foi desenhado para o fundo escuro: gravado por
 * cima dentro do wrapper claro, a aba ativa, o botão e o dia escolhido saíam bege sobre creme
 * (1,1:1), em todo negócio que nunca escolheu cor. A matemática está em `core/text/cor.ts`; esta
 * guarda confere a FIAÇÃO: o layout passa pelo `acentoNoTemaClaro` e não escreve o osso.
 */
const layout = readFileSync('src/app/(public)/[slug]/layout.tsx', 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('layout público [slug]: acento sobre fundo claro', () => {
  it('o layout foi lido (guarda contra passar vazia)', () => {
    expect(layout).toContain('data-theme="light"')
  })

  it('o acento passa por acentoNoTemaClaro, chamado de fato', () => {
    expect(layout).toMatch(/acentoNoTemaClaro\(\s*perfil\.accentColor\.acc\s*\)/)
  })

  it('o osso de fábrica não é mais gravado por cima do tema claro', () => {
    expect(layout.toLowerCase()).not.toContain('#f0ebe3')
    expect(layout.toLowerCase()).not.toContain('#fffcf7')
  })

  it('as quatro variáveis do acento só entram juntas, dentro da condição', () => {
    for (const v of ["'--acc'", "'--acc-2'", "'--acc-soft'", "'--on-acc'"]) expect(layout, `${v} fora do lugar`).toContain(v)
    expect(layout).toMatch(/\.\.\.\(acento && \{[\s\S]*'--acc'[\s\S]*'--on-acc'[\s\S]*\}\)/)
  })
})
