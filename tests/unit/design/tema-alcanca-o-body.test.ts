import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O tema claro (2026-09-10) vive num `<div data-theme>` que o `admin/layout.tsx` embrulha, não no
 * `<html>` — para não tornar `/` dinâmica lendo cookie no layout raiz.
 *
 * Isso tem uma armadilha que só aparece no navegador: **variável CSS não sobe para o ancestral**.
 * O `<body>` fica ACIMA do wrapper, então `body { background: var(--bg) }` e `body { color:
 * var(--txt) }` resolvem no escuro mesmo com o wrapper no claro — e o `<body>` aparecia escuro
 * nas bordas, e os títulos de card herdavam a `color` já computada em escuro.
 *
 * O conserto tem três peças e esta guarda cobra as três:
 *  1. `#raiz-do-tema` pinta o próprio `background` (a cor não desce para ele sozinha do `body`).
 *  2. `#raiz-do-tema` declara `color: var(--txt)` (senão a subárvore herda o valor escuro pronto).
 *  3. `admin/layout` emite um `<style>` que estende a cor ao `<html>`/`<body>` (rubber-band).
 */

const CSS = readFileSync('src/app/globals.css', 'utf8')
const ADMIN_LAYOUT = readFileSync('src/app/admin/layout.tsx', 'utf8')

describe('o tema do wrapper alcança o que está acima dele', () => {
  it('#raiz-do-tema pinta o próprio fundo', () => {
    // Casa com a regra CSS de verdade (`#raiz-do-tema { ... background: var(--bg) }`), não com a
    // string solta — o id aparece no comentário e no `admin/layout` por outros motivos.
    const bloco = CSS.slice(CSS.indexOf('#raiz-do-tema {'), CSS.indexOf('}', CSS.indexOf('#raiz-do-tema {')))
    expect(bloco, 'o wrapper de tema parou de pintar o próprio fundo').toMatch(/background:\s*var\(--bg\)/)
  })

  it('#raiz-do-tema re-declara color, senão a subárvore herda o texto escuro do body', () => {
    const bloco = CSS.slice(CSS.indexOf('#raiz-do-tema {'), CSS.indexOf('}', CSS.indexOf('#raiz-do-tema {')))
    expect(
      bloco,
      'sem `color: var(--txt)` no wrapper, os títulos de card ficam quase invisíveis no tema claro ' +
        '(herdam a cor JÁ COMPUTADA do body, que é escura)',
    ).toMatch(/color:\s*var\(--txt\)/)
  })

  it('admin/layout estende a cor de fundo ao html/body', () => {
    // O `<style>` inline: `style-src` da CSP permite inline, só `script-src` tem strict-dynamic.
    expect(ADMIN_LAYOUT, 'sumiu o <style> que cobre o rubber-band do celular no tema claro').toMatch(
      /html,body\{background:/,
    )
  })

  it('o wrapper carrega o data-theme do COOKIE lido no servidor, não de um script', () => {
    // A primeira tentativa usava <script> no <head> e a CSP bloqueava. Se isto voltar a casar
    // `localStorage` no caminho do servidor, o flash e o bloqueio voltaram junto.
    expect(ADMIN_LAYOUT).toMatch(/ciclo-tema=/)
    expect(ADMIN_LAYOUT).toMatch(/data-theme=\{dataTheme\}/)
    expect(
      /dangerouslySetInnerHTML[\s\S]{0,120}localStorage/.test(ADMIN_LAYOUT),
      'voltou um <script> lendo localStorage no layout — a CSP bloqueia e o nonce dá mismatch',
    ).toBe(false)
  })

  it('os três valores de data-theme que o CSS entende estão mapeados', () => {
    // `globals.css` tem blocos para `light`, `dark` e `sistema`. Se o layout mandar outra string,
    // o tema não aplica e ninguém vê erro.
    for (const v of ['sistema', 'light', 'dark']) {
      expect(CSS, `globals.css não trata data-theme="${v}"`).toContain(`data-theme="${v}"`)
    }
  })
})
