import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  NOME_DO_PLANO,
  ORDEM_DOS_PLANOS,
  PRECO_MENSAL_CENTS,
  precoDoPlano,
  precoDoPlanoPorMes,
} from '@/core/billing/planos'

/**
 * Guarda contra a duplicação voltar.
 *
 * Nome e preço dos planos já estiveram espalhados por cinco arquivos — o serviço de planos, a tela
 * de bloqueio, "Meu plano", a tela de módulos e a página pública de preço — porque cada tela foi
 * escrita numa rodada diferente e cada uma redeclarou o que precisava. Preço que existe em cinco
 * lugares é preço que um dia diverge em um deles, e o lugar onde ninguém olha é sempre o errado.
 *
 * O projeto já usa este padrão de teste que varre o código-fonte (`actions-fixadas`,
 * `titulos-de-tela`): é a forma de uma regra de arquitetura ter dente em vez de virar comentário.
 */

/**
 * O separador entre "R$" e o número, em `Intl.NumberFormat('pt-BR')`, é espaço NÃO-QUEBRÁVEL —
 * de propósito: é o que impede "R$" ficar sozinho no fim de uma linha num celular de 390px.
 *
 * Construído por código de caractere, e nunca escrito solto: NBSP literal no fonte é invisível
 * na revisão e some sem aviso se alguém rodar um formatador que normaliza espaço em branco.
 */
const NBSP = String.fromCharCode(0xa0)

const RAIZ = 'src'
const FONTE_UNICA = join('src', 'core', 'billing', 'planos.ts').replace(/\\/g, '/')

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho.replace(/\\/g, '/')] : []
  })
}

const TODOS = arquivos(RAIZ).filter((f) => f !== FONTE_UNICA)

describe('nome e preço de plano existem num lugar só', () => {
  it('nenhum arquivo fora do core redeclara a tabela de nomes', () => {
    const culpados = TODOS.filter((f) => {
      const src = readFileSync(f, 'utf8')
      // Uma tabela de nomes é reconhecível por mapear os quatro degraus para texto.
      return /gratis:\s*['"]Grátis['"]/.test(src) && /avancado:\s*['"]Avançado['"]/.test(src)
    })
    expect(culpados, `redeclaram NOME_DO_PLANO: ${culpados.join(', ')}`).toEqual([])
  })

  it('nenhum arquivo fora do core escreve um preço de plano à mão', () => {
    /*
     * Normalizar o NBSP é o que faz este guarda ter dente. Ninguém digita espaço não-quebrável à
     * mão — um humano escreve "R$ 49" com espaço comum. Sem normalizar, a busca procuraria uma
     * string que jamais apareceria no código-fonte e passaria vazia para sempre. Foi exatamente o
     * que aconteceu na primeira versão deste teste, e só apareceu porque a asserção de formato lá
     * embaixo falhou com o indecifrável "expected 'R$ 49' to be 'R$ 49'".
     */
    const normalizar = (t: string) => t.split(NBSP).join(' ')
    const proibidos = ORDEM_DOS_PLANOS.filter((t) => PRECO_MENSAL_CENTS[t] > 0).map((t) =>
      normalizar(precoDoPlano(t)),
    )

    const culpados = TODOS.filter((f) => {
      const src = readFileSync(f, 'utf8')
      // Comentário citando o preço é documentação, não duplicação — só o código conta.
      const semComentarios = normalizar(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))
      return proibidos.some((preco) => semComentarios.includes(preco))
    })

    expect(culpados, `preço de plano escrito à mão em: ${culpados.join(', ')}`).toEqual([])
  })
})

describe('a tabela de preço é coerente consigo mesma', () => {
  it('o grátis custa zero e os pagos são crescentes', () => {
    expect(PRECO_MENSAL_CENTS.gratis).toBe(0)
    const pagos = ORDEM_DOS_PLANOS.filter((t) => t !== 'gratis').map((t) => PRECO_MENSAL_CENTS[t])
    expect(pagos).toEqual([...pagos].sort((a, b) => a - b))
    expect(new Set(pagos).size).toBe(pagos.length)
  })

  it('todo degrau tem nome e preço — nenhum fica sem', () => {
    for (const t of ORDEM_DOS_PLANOS) {
      expect(NOME_DO_PLANO[t]).toBeTruthy()
      expect(PRECO_MENSAL_CENTS[t]).toBeTypeOf('number')
    }
  })

  it('preço sai sem centavos, com NBSP, e o grátis não vira "R$ 0/mês"', () => {
    expect(precoDoPlano('essencial')).toBe(`R$${NBSP}49`)
    expect(precoDoPlano('gratis')).toBe(`R$${NBSP}0`)
    expect(precoDoPlanoPorMes('essencial')).toBe(`R$${NBSP}49/mês`)
    // "/mês" num preço de zero sugere cobrança recorrente de zero, que é pior que só "R$ 0".
    expect(precoDoPlanoPorMes('gratis')).toBe(`R$${NBSP}0`)
  })
})
