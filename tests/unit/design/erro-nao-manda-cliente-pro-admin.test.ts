import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

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
  return semComentarios(readFileSync(ERRO, 'utf8'))
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
    /*
     * TODAS as ocorrências, e sem depender da caixa nem da posição na frase. A versão anterior
     * usava `indexOf('Seus dados estão salvos')` e quebrou quando a frase virou fim de período
     * (`seus`, minúsculo) na faxina de travessões — e "guarda quebrou, ajusta a guarda" é onde a
     * proteção afrouxa sem ninguém ver. Conferir cada ocorrência é mais forte que conferir a
     * primeira: uma segunda cópia solta no JSX passava despercebida.
     */
    const src = fonte()
    const ocorrencias = [...src.matchAll(/[Ss]eus dados estão salvos/g)]
    expect(ocorrencias.length, 'não achei a frase; se foi removida, ajuste este teste junto').toBeGreaterThan(0)
    for (const oco of ocorrencias) {
      const antes = src.slice(Math.max(0, oco.index - 200), oco.index)
      expect(
        /noPainel|\?\s*$|\?\s*\n/.test(antes),
        `a frase precisa estar condicionada ao painel; na rota pública ela é falsa (posição ${oco.index})`,
      ).toBe(true)
    }
  })
})

/**
 * A REGRA VALE PARA TODO BOUNDARY, e esta guarda olhava um só.
 *
 * `src/app/error.tsx` é onde o defeito apareceu, e a guarda acima ficou ancorada nele — a forma
 * clássica de [[guarda-cega-de-raiz]], que já custou caro nesta base mais de uma vez. O Next tem
 * outros três pontos que o visitante público alcança: `global-error.tsx` (que substitui o layout
 * RAIZ inteiro), `not-found.tsx` e qualquer `error.tsx` de segmento.
 *
 * Medido em 2026-09-09: os três mandam para `/`, então **não há defeito hoje**. O que havia era a
 * ausência de vigia — um `href="/admin"` acrescentado a `global-error.tsx` amanhã passaria verde,
 * na tela que o cliente do salão vê quando tudo quebra.
 *
 * A varredura é por diretório, e não por lista: boundary NOVO entra sozinho, que é a única forma
 * de a guarda não voltar a ficar ancorada.
 */

const BOUNDARY = /^(error|global-error|not-found)\.tsx$/

/** O boundary do painel pode mandar para o painel: ele só sombreia rotas `/admin`. */
const SO_SOMBREIA_O_PAINEL = 'src/app/admin/error.tsx'

function boundaries(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).split(String.fromCharCode(92)).join('/')
    if (entrada.isDirectory()) achados.push(...boundaries(caminho))
    else if (BOUNDARY.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

describe('nenhum boundary que o cliente do salão alcança oferece o painel', () => {
  const TODOS = boundaries('src/app')

  it('a varredura acha os boundaries — não passa por não ter olhado nada', () => {
    expect(TODOS.length, 'nenhum boundary encontrado — a varredura cegou').toBeGreaterThan(2)
    // Positivos conhecidos: os quatro de 2026-09-09.
    for (const esperado of ['src/app/error.tsx', 'src/app/global-error.tsx', 'src/app/not-found.tsx']) {
      expect(TODOS, `${esperado} saiu do alcance`).toContain(esperado)
    }
    expect(TODOS, 'o boundary do painel sumiu — a isenção abaixo ficou sem objeto').toContain(SO_SOMBREIA_O_PAINEL)
  })

  it.each(TODOS.filter((b) => b !== SO_SOMBREIA_O_PAINEL))('%s não manda para o painel', (arquivo) => {
    const src = semComentarios(readFileSync(arquivo, 'utf8'))
    /*
     * `href="/admin…"` literal. O ramo condicional de `error.tsx` monta o destino do painel por
     * variável, e é legítimo — proibir a string solta proibiria o próprio conserto que a metade de
     * cima desta guarda exige.
     */
    expect(
      /href="\/admin/.test(src),
      `${arquivo} oferece o painel como saída. Quem cai aqui pode ser o cliente do salão, e o ` +
        'painel é um login que não é dele — quem passa vergonha é o salão, não o CICLO.',
    ).toBe(false)
  })
})
