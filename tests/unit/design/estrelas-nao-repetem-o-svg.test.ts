import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * As cinco estrelas de cada avaliação eram cinco `<Star>` do lucide, e o lucide inlina o `<path>`
 * inteiro em cada uma. Medido no HTML de produção de `/demo-dom-estilo`: **26 estrelas ocupavam
 * 16.978 B de uma página de 75.660 B — 22% do documento era o mesmo ícone repetido.**
 *
 * Isso importa porque o gargalo do celular antigo aqui é o DOCUMENTO, não o JavaScript: o bundle
 * é 104 kB de framework (piso do Next, não dá para cortar) e o Total Blocking Time medido foi de
 * 33 ms — a CPU não sofre. Quem sofre é o 3G baixando HTML.
 *
 * O conserto é `<symbol>` + `<use>`. E ele tem uma armadilha de cascata que só aparece na tela:
 *
 * **`fill="none"` tem que ficar no `<svg>` que USA, nunca no `<symbol>`.** A primeira versão
 * copiou o atributo do lucide para dentro do símbolo; ali ele fica mais perto do `<path>` do que
 * a classe `fill-acc-2` do `<svg>` externo, ganha da cascata, e as 25 estrelas renderizaram
 * VAZADAS. Typecheck, lint e testes passaram — só a captura de tela denunciou.
 */
const TELA = join('src', 'app', '(public)', '[slug]', 'secoes.tsx')

function fonte(): string {
  const src = semComentarios(readFileSync(TELA, 'utf8'))
  if (!src.includes('<symbol')) throw new Error(`nenhum <symbol> em ${TELA} — a guarda perdeu o alvo`)
  return src
}

function blocoDoSymbol(): string {
  const src = fonte()
  const i = src.indexOf('<symbol')
  // Delimita pelo fim REAL da tag de abertura, não por janela de caracteres.
  return src.slice(i, src.indexOf('>', i))
}

describe('as estrelas da avaliação não repetem o SVG', () => {
  it('cada estrela é um <use>, não uma cópia do path', () => {
    expect(fonte(), 'sem <use> as 25 estrelas voltam a inlinar o path inteiro, +12 kB por página').toMatch(/<use\s+href=/)
  })

  it('o path da estrela aparece UMA vez no arquivo', () => {
    // Duas ocorrências significa que alguém voltou a desenhar a estrela em outro lugar em vez de
    // referenciar o símbolo — o defeito voltando por outra porta.
    const ocorrencias = fonte().match(/M11\.525 2\.295/g) ?? []
    expect(ocorrencias).toHaveLength(1)
  })

  it('o <symbol> NÃO define fill — senão as estrelas saem vazadas', () => {
    // A armadilha da v1, medida na tela. O atributo dentro do símbolo vence a classe do `<svg>`
    // externo por proximidade na cascata.
    expect(
      blocoDoSymbol(),
      '`fill` no <symbol> ganha de `fill-acc-2` e apaga o preenchimento das 25 estrelas',
    ).not.toMatch(/fill=/)
  })

  it('o <svg> que usa o símbolo define fill="none" — é ele que a classe sobrepõe', () => {
    const src = fonte()
    const i = src.indexOf('<use')
    const svgQueUsa = src.slice(src.lastIndexOf('<svg', i), i)
    expect(svgQueUsa).toMatch(/fill="none"/)
  })

  it('a nota tem alternativa em texto para leitor de tela', () => {
    // As estrelas são `aria-hidden`. Sem esta linha, quem não enxerga lê o comentário sem saber
    // se veio de uma nota 5 ou 2.
    expect(fonte()).toMatch(/sr-only[^>]*>\{r\.rating\} de 5 estrelas/)
  })
})
