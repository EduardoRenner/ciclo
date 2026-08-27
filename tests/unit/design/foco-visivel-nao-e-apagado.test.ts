import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `globals.css` §7 define o anel de foco de uma vez para todo o produto:
 * `:focus-visible { outline: 2px solid var(--ring) }`. É o que faz quem navega por teclado saber
 * onde está — WCAG 2.4.7.
 *
 * `outline-none` apaga esse anel só naquele elemento. Às vezes é legítimo: quem apaga costuma
 * desenhar o próprio indicador na mesma classe (`focus:border-acc`, um `ring`, um fundo). O que
 * não pode é apagar e **não repor nada**.
 *
 * Achado em 2026-08-27 no `admin/caixa/seletor-de-dia.tsx`: um `<input type="date">` com
 * `outline-none` e nenhum substituto — a borda visível é do `<label>` em volta, que não reage ao
 * foco do input. Quem chegasse ali de teclado não via sinal nenhum. E o comentário do próprio
 * componente, três linhas acima, elogia o campo nativo por "já vir acessível".
 *
 * A guarda casa com o que MUDA quando o defeito volta: `outline-none` presente **sem** nenhum
 * indicador de foco no mesmo `className`. Não proíbe `outline-none` — proíbe apagar sem repor.
 */

const RAIZ = 'src'

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (entrada.name.endsWith('.tsx')) achados.push(caminho)
  }
  return achados
}

/** Um indicador de foco qualquer: anel, borda, fundo ou sombra que reaja a `focus`/`focus-visible`. */
const REPOE_O_FOCO = /focus(-visible)?:(ring|border|outline|bg|shadow)/

type Achado = { arquivo: string; trecho: string }

function apagamSemRepor(): Achado[] {
  const achados: Achado[] = []
  for (const arquivo of arquivos(RAIZ)) {
    const src = readFileSync(arquivo, 'utf8')
    // Cada `className="..."` (ou `className={'...'}`) que contenha `outline-none`.
    for (const m of src.matchAll(/className=\{?["'`]([^"'`]*)["'`]/g)) {
      const classes = m[1] ?? ''
      if (!/\boutline-none\b/.test(classes)) continue
      if (REPOE_O_FOCO.test(classes)) continue
      achados.push({ arquivo, trecho: classes.trim().slice(0, 70) })
    }
  }
  return achados
}

describe('foco visível não é apagado sem substituto', () => {
  it('o leitor enxerga os componentes — não passa por não ter olhado nada', () => {
    // Guarda contra o próprio detector: se o glob ou o regex de `className` parar de casar, o
    // teste abaixo passaria vazio, que é o pior estado possível para uma guarda.
    const todos = arquivos(RAIZ)
    expect(todos.length, 'nenhum .tsx encontrado em src/').toBeGreaterThan(50)
    const comClassName = todos.filter((a) => /className=/.test(readFileSync(a, 'utf8')))
    expect(comClassName.length, 'nenhum className encontrado — o regex quebrou').toBeGreaterThan(30)
  })

  it('nenhum elemento apaga o anel global sem desenhar o próprio', () => {
    const achados = apagamSemRepor()
    expect(
      achados.map((a) => `${a.arquivo} → "${a.trecho}"`),
      'estes elementos usam `outline-none` e não repõem indicador de foco nenhum no mesmo ' +
        'className — quem navega por teclado fica sem saber onde está (WCAG 2.4.7). Ou tire o ' +
        '`outline-none` e deixe o anel global de globals.css §7 valer, ou desenhe um substituto ' +
        '(`focus:border-…`, `focus-visible:ring-…`).',
    ).toEqual([])
  })
})
