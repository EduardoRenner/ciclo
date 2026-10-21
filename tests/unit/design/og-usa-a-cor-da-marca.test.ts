import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A marca aparece em quatro lugares que não leem o `globals.css`: a prévia do link
 * (`opengraph-image.tsx`, renderizada sem CSS), o favicon (`icon.svg`), o botão da tela de erro
 * total (`global-error.tsx`, que existe justamente quando o CSS pode não ter carregado) e o
 * próprio `--acc`. Os três primeiros têm a cor cravada.
 *
 * O comentário da `opengraph-image.tsx` citava esta guarda desde agosto, e ela não existia:
 * achado em 20/10/2026, na troca do turquesa pelo rosé (`docs/109-marca-feminina`). Sem ela, a
 * troca de cor deixaria a prévia do WhatsApp na cor antiga sem nenhum teste reprovar, e é a
 * primeira coisa que uma profissional vê quando outra manda o link.
 */

const CSS = readFileSync('src/app/globals.css', 'utf8')

/** O `--acc` do `:root`, que é o tema escuro padrão e o fundo da prévia. */
function accDoRoot(): string {
  const root = semComentarios(CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('}', CSS.indexOf(':root {'))))
  const achado = root.match(/--acc:\s*(#[0-9a-f]{6})\s*;/i)
  if (!achado?.[1]) throw new Error('não achei --acc no :root do globals.css; a guarda ficou cega')
  return achado[1].toLowerCase()
}

function hexes(caminho: string): string[] {
  const fonte = semComentarios(readFileSync(caminho, 'utf8'))
  return [...fonte.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase())
}

/*
  docs/114 F3 (21/10): a logo final aprovada pelo Vitor tem cor própria, anel azul e seta rosa, que
  não é o --acc do app. A prévia do link (`opengraph-image.png`) e o favicon (`icon.svg`) passaram a
  ser os arquivos aprovados, conferidos pela `logo-final.test.ts`. O --acc continua mandando onde a
  marca é cor de botão: a tela de erro total e a página sem internet.
*/
describe('a cor de botão cravada fora do CSS acompanha o --acc', () => {
  const acc = accDoRoot()

  it('a tela de erro total usa o --acc', () => {
    expect(hexes('src/app/global-error.tsx'), `global-error.tsx não usa ${acc}`).toContain(acc)
  })

  /*
    A página de "não conseguimos abrir" (`public/sem-internet.html`) é clara e não pode ler o CSS do
    app (abre sem rede, do próprio aparelho). Escapou da troca para o rosé e foi achada só ao vê-la
    no navegador: botão ainda turquesa. Ela usa o --acc do tema claro.
  */
  it('a página sem internet usa o --acc do tema claro', () => {
    const blocoClaro = semComentarios(CSS.slice(CSS.indexOf('[data-theme="light"] {')))
    const accClaro = blocoClaro.match(/--acc:\s*(#[0-9a-f]{6})\s*;/i)?.[1]?.toLowerCase()
    if (!accClaro) throw new Error('não achei --acc do tema claro; a guarda ficou cega')
    const pagina = readFileSync('public/sem-internet.html', 'utf8')
    expect(pagina.match(/--acc:\s*(#[0-9a-f]{6})/i)?.[1]?.toLowerCase(), 'sem-internet.html').toBe(accClaro)
  })

  it('a tela de erro total e o favicon não ficaram com as cores anteriores da marca', () => {
    for (const caminho of ['src/app/icon.svg', 'src/app/global-error.tsx']) {
      expect(hexes(caminho), caminho).not.toContain('#14b8a6')
    }
    expect(hexes('src/app/icon.svg'), 'o favicon ainda tem o rosé da logo de 20/10').not.toContain('#d4949f')
  })
})
