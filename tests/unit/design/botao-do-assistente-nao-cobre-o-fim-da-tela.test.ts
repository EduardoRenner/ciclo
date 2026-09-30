import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O botão do assistente é `fixed`, ancorado acima da tab bar, e desde o MI-2 (docs/85) aparece para
 * todo mundo. MEDIDO em 2026-09-29 a 375px, no fim da rolagem de `/admin/clientes/vindo-de-outro-
 * sistema`: o botão ocupava y 676–732 e a última frase da tela y 684–703 — o ponto no fim da frase
 * acertava o botão, não o texto. A causa era do layout, não da tela: o `pb` do `<main>` reservava
 * `tabbar + 28px`, e o botão fica em `tabbar + 16px` com 56px de altura.
 *
 * A guarda lê os DOIS lados da conta dos próprios arquivos (não um número copiado): se o botão
 * subir ou crescer, ela reprova até a folga acompanhar.
 */

const PX_POR_UNIDADE_TAILWIND = 4

const layout = semComentarios(readFileSync('src/app/admin/layout.tsx', 'utf8'))
const botao = semComentarios(readFileSync('src/components/shell/assistente-flutuante.tsx', 'utf8'))

const folgaDoMain = /<main className="[^"]*pb-\[calc\(var\(--tabbar-h\)\+env\(safe-area-inset-bottom\)\+(\d+)px\)\]/.exec(layout)
const distanciaDoBotao = /bottom-\[calc\(var\(--tabbar-h\)\+env\(safe-area-inset-bottom\)\+(\d+)px\)\]/.exec(botao)
// Ancorado na classe do BOTÃO: um `size-N` solto casava com o primeiro ícone do arquivo (size-1).
const tamanhoDoBotao = /z-30 grid size-(\d+) /.exec(botao)

describe('o botão do assistente não cobre o fim das telas do painel', () => {
  it('acha os três números — não passa por não ter lido nada', () => {
    expect(folgaDoMain, 'não achei o pb do <main> em admin/layout.tsx').not.toBeNull()
    expect(distanciaDoBotao, 'não achei o bottom do botão em assistente-flutuante.tsx').not.toBeNull()
    expect(tamanhoDoBotao, 'não achei o size-N do botão').not.toBeNull()
  })

  it('o botão continua sendo o motivo da folga: está no layout e é fixed', () => {
    expect(layout).toMatch(/<AssistenteFlutuante\b/)
    expect(botao).toContain('fixed')
  })

  it('a folga do fim da tela é maior que a distância do botão + a altura dele', () => {
    const folga = Number(folgaDoMain![1])
    const topoDoBotao = Number(distanciaDoBotao![1]) + Number(tamanhoDoBotao![1]) * PX_POR_UNIDADE_TAILWIND
    expect(folga, `a folga (${folga}px acima da tab bar) não passa do topo do botão (${topoDoBotao}px)`).toBeGreaterThan(topoDoBotao)
  })
})
