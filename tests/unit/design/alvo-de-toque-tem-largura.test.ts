import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * `toque-48` estende o alvo **só na vertical**, e isso passou despercebido até ser medido.
 *
 * A utilidade em `globals.css` desenha uma faixa de 48px de altura com `left: 0; right: 0` — ela
 * herda a largura do elemento. Num botão ou num item de lista isso basta, porque a largura já vem
 * do layout. Num LINK CURTO em linha, não: o alvo continua estreito.
 *
 * Medido ao vivo em 2026-09-09, na home a 320px de largura: "Preços" tinha **39x48** e "Termos"
 * **42x48**. Passam no mínimo da WCAG 2.5.8 (24x24) e ficam abaixo do piso de 48px da casa, no
 * eixo que ninguém tinha olhado.
 *
 * ## O conserto, e por que ele não mora no CSS
 *
 * `px-2 -mx-2` no próprio link: a caixa cresce 16px e a margem negativa devolve o espaço, então o
 * texto não se move e o vizinho não é empurrado. Medido injetando o estilo na página antes de
 * escrever o código: 39→55px, 42→58px, zero colisão entre as caixas de toque, deslocamento zero.
 *
 * Alargar a faixa dentro da utilidade seria o conserto errado, e a base já pagou por ele: viraria
 * 48px de largura nos 52 usos, e em lista densa a faixa de um vizinho cobre a do outro — foi
 * exatamente assim que **dois links inline ficaram com o segundo sem área tocável nenhuma**.
 * Largura se resolve onde o layout é conhecido.
 */

/** Os links em linha do rodapé institucional, nas cinco telas que os repetem. */
const TELAS = [
  'src/app/page.tsx',
  'src/app/(public)/precos/page.tsx',
  'src/app/(public)/privacidade/page.tsx',
  'src/app/(public)/termos/page.tsx',
  'src/app/(auth)/cadastro/formulario.tsx',
]

/** O estilo compartilhado desses links. `toque-48` resolve a altura; `px-2` resolve a largura. */
const ESTILO = /toque-48[^"]*\bpx-2\b/

describe('link em linha tem alvo nos DOIS eixos', () => {
  it.each(TELAS)('%s dá largura ao alvo, não só altura', (tela) => {
    const fonte = readFileSync(tela, 'utf8')

    // Piso: se a tela parar de usar `toque-48`, esta guarda ficou sem objeto e precisa sair daqui.
    expect(fonte, `${tela} não usa mais toque-48 — tire-a desta lista`).toContain('toque-48')

    const linhas = fonte.split('\n').filter((l) => l.includes('toque-48') && l.includes('underline'))
    expect(linhas.length, `${tela} não tem mais link em linha com toque-48`).toBeGreaterThan(0)

    for (const linha of linhas) {
      expect(
        ESTILO.test(linha),
        `${tela}: link em linha com \`toque-48\` e sem \`px-2\`. A faixa de 48px é só ALTURA — ` +
          '"Preços" media 39px de largura assim. Use `px-2 -mx-2`: cresce o alvo sem mover o texto.',
      ).toBe(true)
    }
  })

  it('a margem negativa acompanha o padding, para o texto não andar', () => {
    /*
     * `px-2` sozinho empurraria os vizinhos e mudaria o desenho do rodapé. O par `-mx-2` é o que
     * torna o conserto invisível — medido: deslocamento zero nos três links.
     */
    for (const tela of TELAS) {
      const fonte = readFileSync(tela, 'utf8')
      for (const linha of fonte.split('\n').filter((l) => l.includes('toque-48') && l.includes('px-2'))) {
        expect(/-mx-2/.test(linha), `${tela}: \`px-2\` sem \`-mx-2\` — o texto do rodapé vai andar`).toBe(true)
      }
    }
  })
})
