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

describe('a marca cravada fora do CSS acompanha o --acc', () => {
  const acc = accDoRoot()

  it('a prévia do link usa o --acc no símbolo e no nome', () => {
    const cores = hexes('src/app/opengraph-image.tsx')
    expect(cores.filter((c) => c === acc).length, `a prévia não usa ${acc}`).toBeGreaterThanOrEqual(2)
  })

  it.each(['src/app/icon.svg', 'src/app/global-error.tsx'])('%s usa o --acc', (caminho) => {
    expect(hexes(caminho), `${caminho} não usa ${acc}`).toContain(acc)
  })

  it('nenhum dos três ficou com a cor anterior da marca', () => {
    for (const caminho of ['src/app/opengraph-image.tsx', 'src/app/icon.svg', 'src/app/global-error.tsx']) {
      expect(hexes(caminho), caminho).not.toContain('#14b8a6')
    }
  })
})
