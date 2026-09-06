import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A lista de cada plano usa dois ícones — `Check` no que inclui, `Minus` no que não inclui — e o
 * lucide inlina o SVG inteiro em cada ocorrência. Medido no HTML de produção de `/precos`:
 * **7.161 B de 52.197, 14% da página só de ícone repetido**, em 24 ocorrências somadas.
 *
 * **Corrigido em 05/09/2026:** aqueles 7.161 B sao HTML CRU. A producao serve
 * `Content-Encoding: br`, e medindo os dois lados a partir do mesmo HTML a economia real desta
 * pagina e **-56 B em brotli** — ou seja, ficou marginalmente PIOR na rede, dentro do ruido.
 * Marcacao repetida e o que o compressor ja elimina de graca. O conserto fica (1.669 B a menos de
 * HTML cru para montar), mas o numero cru nao deve ser citado como economia de banda, e o padrao
 * nao deve ser aplicado em lugar novo esperando ganho de transferencia.
 *
 * Mesmo conserto das estrelas da página do salão, e com a mesma armadilha de cascata: o
 * `fill="none"` fica no `<svg>` que USA, nunca no `<symbol>`. Dentro do símbolo o atributo fica
 * mais perto do `<path>` do que a classe do elemento externo, ganha, e o ícone some ou inverte —
 * foi exatamente assim que a primeira versão daquele conserto renderizou 25 estrelas vazadas,
 * com typecheck, lint e suíte inteira verdes.
 */
const PRECOS = join('src', 'app', '(public)', 'precos', 'page.tsx')

function fonte(): string {
  const src = semComentarios(readFileSync(PRECOS, 'utf8'))
  if (!src.includes('<symbol')) throw new Error(`nenhum <symbol> em ${PRECOS} — a guarda perdeu o alvo`)
  return src
}

describe('a lista de planos não repete o SVG do ícone', () => {
  it('os itens usam <use>, não um componente que inlina o path', () => {
    expect(fonte()).toMatch(/<use\s+href=/)
  })

  it('nenhum <Check> ou <Minus> do lucide sobrou na lista', () => {
    // O import some junto: se voltar, o ícone volta a ser inlinado 24 vezes.
    const src = fonte()
    expect(src).not.toMatch(/<Check\b/)
    expect(src).not.toMatch(/<Minus\b/)
  })

  it('cada path é desenhado UMA vez', () => {
    const src = fonte()
    expect(src.match(/M20 6 9 17l-5-5/g) ?? []).toHaveLength(1)
    expect(src.match(/d="M5 12h14"/g) ?? []).toHaveLength(1)
  })

  it('os <symbol> NÃO definem fill — senão o ícone quebra na cascata', () => {
    const src = fonte()
    for (const bloco of src.match(/<symbol[^>]*>/g) ?? []) {
      expect(bloco, 'fill dentro do <symbol> ganha da classe do <svg> externo').not.toMatch(/fill=/)
    }
  })

  it('cada <svg> que usa define fill="none"', () => {
    const src = fonte()
    const usos = [...src.matchAll(/<svg[^>]*>\s*<use/g)].map((m) => m[0])
    expect(usos.length).toBeGreaterThanOrEqual(2)
    for (const u of usos) expect(u).toMatch(/fill="none"/)
  })
})
