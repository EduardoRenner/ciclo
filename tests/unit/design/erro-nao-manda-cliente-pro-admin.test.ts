import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * `src/app/error.tsx` é o boundary da RAIZ: ele pega toda rota, inclusive as públicas.
 *
 * Medido no navegador em 2026-08-25, quebrando o `fetch` de propósito em `/dom-rocha/agendar`: um
 * único pedido que falha ao escolher o dia derruba a tela inteira e cai aqui. E o que a pessoa
 * encontrava era escrito para outra pessoa:
 *
 *   "Seus dados estão salvos"  → ela não estava salvando nada, estava escolhendo horário;
 *   botão "Ir para Hoje"       → `/admin/hoje`, o painel do PROFISSIONAL.
 *
 * Quem está nessa tela é o **cliente do salão**. O botão o mandava para um login que não é dele —
 * e quem fica mal com isso é o salão, não o CICLO. É o mesmo raciocínio do `docs/21` sobre a
 * promessa de WhatsApp: a superfície do cliente do tenant é onde o erro custa mais caro.
 */

const ERRO = 'src/app/error.tsx'

function fonte(): string {
  return readFileSync(ERRO, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('a tela de erro não manda o cliente do salão para o painel', () => {
  it('decide a saída pelo caminho onde o erro aconteceu', () => {
    const src = fonte()
    expect(/usePathname\(\)/.test(src), 'a tela de erro precisa saber ONDE está para oferecer a saída certa').toBe(true)
    expect(/startsWith\('\/admin'\)/.test(src), 'falta distinguir o painel das rotas públicas').toBe(true)
  })

  it('`/admin/hoje` nunca é destino incondicional', () => {
    /*
     * O defeito original em uma linha: `href="/admin/hoje"` fixo. Esta asserção casa com o
     * ATRIBUTO literal, não com a string solta — a string continua legítima dentro do ramo do
     * painel, e proibi-la ali seria proibir o conserto.
     */
    const src = fonte()
    expect(
      /href="\/admin\/hoje"/.test(src),
      'o link para o painel está fixo — numa rota pública isso manda o cliente do salão para um login que não é dele',
    ).toBe(false)
  })

  it('a rota pública ganha uma saída própria, e ela usa o slug', () => {
    const src = fonte()
    expect(/\$\{slug\}/.test(src), 'a saída pública precisa voltar para a página do estabelecimento').toBe(true)
  })

  it('a frase de conforto não afirma o que seria falso na rota pública', () => {
    /*
     * "Seus dados estão salvos" é verdade no painel e mentira em quem estava escolhendo horário.
     * A asserção exige que ela esteja num ramo condicional, não solta no JSX.
     */
    const src = fonte()
    const i = src.indexOf('Seus dados estão salvos')
    expect(i, 'não achei a frase — se foi removida, ajuste este teste junto').toBeGreaterThan(-1)
    const antes = src.slice(Math.max(0, i - 200), i)
    expect(
      /noPainel|\?\s*$|\?\s*\n/.test(antes),
      'a frase precisa estar condicionada ao painel — na rota pública ela é falsa',
    ).toBe(true)
  })
})
