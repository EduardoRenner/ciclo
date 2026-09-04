import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O logo do salão sobe sobre a capa por margem negativa. Se o elemento que o CONTÉM recortar o
 * que sai da caixa, o logo é cortado — e foi o que aconteceu por mais de um mês.
 *
 * Medido na produção em 2026-09-04 com `getBoundingClientRect`: logo em y=197,2 com 80 px de
 * altura, `<section>` que o contém em y=253,2 com `overflow: hidden`. **56 px cortados, 70% do
 * logo invisível** — no lugar da marca aparecia um risco de meia-lua. Forçar `overflow: visible`
 * no navegador fez o monograma aparecer inteiro, que é a prova de causa.
 *
 * A armadilha é de composição, não de descuido: o `overflow-hidden` era ANTERIOR ao logo, e quem
 * acrescentou a margem negativa não tinha como ver o corte porque nenhum tenant tinha logo
 * cadastrada. O defeito nasceu quando as contas de demonstração ganharam marca — meses depois das
 * duas linhas terem sido escritas, cada uma correta sozinha.
 *
 * Esta guarda casa com as duas metades da combinação, porque é a COMBINAÇÃO que quebra: nem a
 * margem negativa nem o recorte são erro por si.
 */
const TELA = join('src', 'app', '(public)', '[slug]', 'secoes.tsx')

function secaoDoLogo(): string {
  const src = semComentarios(readFileSync(TELA, 'utf8'))
  const inicio = src.indexOf('<section')
  if (inicio === -1) throw new Error(`nenhuma <section> em ${TELA} — a guarda perdeu o alvo`)
  // Delimita pelo fim REAL da tag de abertura, não por janela de caracteres: as classes de outra
  // section cairiam dentro de uma janela fixa e a guarda casaria pelo motivo errado.
  const fimDaTag = src.indexOf('>', inicio)
  return src.slice(inicio, fimDaTag)
}

describe('o logo do salão não é cortado pela capa', () => {
  it('o logo sobe sobre a capa por margem negativa (o motivo de a guarda existir)', () => {
    const src = semComentarios(readFileSync(TELA, 'utf8'))
    expect(src).toMatch(/-mt-14/)
  })

  it('a section que contém o logo NÃO recorta o que sai da caixa', () => {
    expect(secaoDoLogo()).not.toMatch(/overflow-hidden/)
  })

  it('a capa continua recortando a própria imagem — o recorte que é legítimo', () => {
    // Tirar `overflow-hidden` da section não pode virar "tirar de todo lugar": a div da capa
    // precisa dele para a imagem não vazar da faixa.
    const src = semComentarios(readFileSync(TELA, 'utf8'))
    expect(src).toMatch(/h-36 overflow-hidden/)
  })
})
