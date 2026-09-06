import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O wordmark da marca aparece em quatro páginas públicas, sempre no mesmo tamanho: `h-7 w-auto`,
 * que a 1102x448 de origem dá **69x28 px** — medido no navegador, não deduzido.
 *
 * Sem a prop `sizes`, o `next/image` não tem como saber disso. Ele cai no `deviceSizes` e monta o
 * `srcSet` pelas larguras de viewport, então o navegador baixa a variante de **1200 px** para um
 * slot de 69. Medido na produção em 2026-09-04, com o `Accept` que um navegador de verdade manda:
 *
 * | variante | PNG | WebP |
 * |---|--:|--:|
 * | `w=1200` (o que era servido) | 8.269 B | **13.248 B** |
 * | `w=256` (o que `sizes` escolhe a 2x) | 2.568 B | **5.450 B** |
 *
 * São **7,8 kB a menos, 59%** — e na landing isso pesa duas vezes, porque aquela imagem é a única
 * com `priority`: ela é pré-carregada e disputa banda com o resto na primeira pintura, que é
 * exatamente o momento que dói no celular antigo com 3G.
 *
 * Nota lateral medida no caminho, e que NÃO é o que esta guarda protege: para este arquivo o WebP
 * é MAIOR que o PNG em toda largura (+178% em `w=640`). É o esperado para logo — pouca cor e área
 * chapada comprimem melhor em PNG com paleta do que em WebP com perda. O `next/image` converte
 * assim que o navegador aceita, e não há controle por imagem. Depois do `sizes` o custo absoluto
 * ficou pequeno o bastante para não valer briga; se um dia valer, o caminho é SVG, que é o formato
 * certo para wordmark.
 */
const PAGINAS = [
  join('src', 'app', 'page.tsx'),
  join('src', 'app', '(public)', 'precos', 'page.tsx'),
  join('src', 'app', '(public)', 'privacidade', 'page.tsx'),
  join('src', 'app', '(public)', 'termos', 'page.tsx'),
]

/** O `<Image>` do wordmark, delimitado pelo fim real da tag — nunca por janela de caracteres. */
function tagDoWordmark(arquivo: string): string {
  const src = semComentarios(readFileSync(arquivo, 'utf8'))
  const i = src.indexOf('<Image src={wordmark}')
  if (i === -1) throw new Error(`${arquivo} não renderiza mais o wordmark — a guarda perdeu o alvo`)
  return src.slice(i, src.indexOf('>', i))
}

describe('a imagem da marca diz de que tamanho ela é', () => {
  it('a guarda alcança as quatro páginas onde o wordmark aparece', () => {
    // Piso afirmado por NOME: uma lista que encolhe em silêncio protege menos do que parece, e
    // aqui isso passaria despercebido porque as outras três continuariam verdes.
    expect(PAGINAS).toHaveLength(4)
    for (const p of PAGINAS) expect(tagDoWordmark(p).length).toBeGreaterThan(0)
  })

  it.each(PAGINAS)('%s declara sizes, senão o navegador baixa a variante de 1200 px', (arquivo) => {
    expect(tagDoWordmark(arquivo)).toMatch(/sizes=/)
  })

  it('a landing mantém o priority — é ela que paga o preload', () => {
    // Se o `priority` sair, o `sizes` continua certo mas o motivo de urgência muda; a guarda
    // deixaria de descrever a realidade e vale saber pela reprovação, não por leitura.
    expect(tagDoWordmark(PAGINAS[0]!)).toMatch(/priority/)
  })
})
