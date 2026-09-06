import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/50` L-07, critério 3: a tela do mês **compõe**, não recalcula.
 *
 * Os cinco números já existem em cinco telas. Um sexto lugar somando lucro seria a segunda fonte
 * da mesma verdade — a armadilha que esta base pagou no livro-caixa, onde pedidos e movimentos de
 * caixa contavam o mesmo dinheiro duas vezes. A tela do mês é justamente a que o dono MOSTRA para
 * alguém: é o pior lugar possível para um total que discorda do caixa.
 *
 * A guarda casa com a CHAMADA (`fn(`) e não com o nome solto, que apareceria na linha de `import`
 * — armadilha nº1 da tabela do `CLAUDE.md`.
 */

const PAGINA = 'src/app/admin/mes/page.tsx'
const TELA = 'src/app/admin/mes/resumo.tsx'

const FONTES_DA_VERDADE = [
  { chamada: /resumoMensal\s*\(/, oQue: 'entrou e sobrou' },
  { chamada: /concentracaoDoMes\s*\(/, oQue: 'de quem depende' },
  { chamada: /listarParaRecuperar\s*\(/, oQue: 'quanto está parado em quem sumiu' },
  { chamada: /prestacaoDeContasDoMotor\s*\(/, oQue: 'o quanto o Motor acertou' },
]

describe('a tela do mês compõe os números que já existem', () => {
  const pagina = semComentarios(readFileSync(PAGINA, 'utf8'))
  const tela = semComentarios(readFileSync(TELA, 'utf8'))

  it('a leitura não voltou vazia', () => {
    expect(pagina.length, `${PAGINA} veio vazio`).toBeGreaterThan(500)
    expect(tela.length, `${TELA} veio vazio`).toBeGreaterThan(500)
  })

  it.each(FONTES_DA_VERDADE)('busca "$oQue" de quem já sabe responder', ({ chamada, oQue }) => {
    expect(chamada.test(pagina), `a tela do mês parou de buscar "${oQue}" na fonte que já existe`).toBe(true)
  })

  /**
   * O componente recebe números prontos e só formata. Uma soma, subtração ou divisão de centavos
   * aqui seria o começo do segundo total — e ela entraria com a melhor das intenções, para
   * "completar" um número que faltou.
   *
   * `/100` (centavos para reais) e `/100` sobre basis points são formatação e passam de propósito:
   * são a conversão de unidade que toda tela desta base faz na borda.
   */
  it('o componente não faz aritmética de dinheiro — só formata', () => {
    const semFormatacao = tela.replace(/\/\s*100\b/g, '')
    const contas = semFormatacao.match(/\w+Cents\s*[-+*/]\s*\w/g) ?? []
    expect(
      contas,
      'a tela do mês começou a calcular em vez de compor. O número tem que vir de quem já o ' +
        'responde, senão esta página vira o segundo total que discorda do caixa.',
    ).toEqual([])
  })

  /**
   * A versão anterior desta asserção era CEGA e o registro fica: ela procurava `acertoBps === null`
   * no arquivo, e a mesma comparação existia noutra linha, no texto de apoio. Ao trocar o `valor`
   * do quadro por `(motor.acertoBps ?? 0)`, a guarda passou verde com o defeito de volta.
   *
   * A regra saiu do JSX e virou `percentualOuTraco` (`core/text/sem-amostra.ts`), com teste de
   * comportamento próprio nos dois lados — sem amostra vira traço, zero medido continua 0%. O que
   * sobra aqui é a única coisa que varredura de fonte prova bem: que a tela CHAMA a função em vez
   * de montar o ternário por conta.
   */
  it('o acerto do Motor passa pela função que separa "sem amostra" de zero', () => {
    expect(/percentualOuTraco\s*\(\s*motor\.acertoBps/.test(tela), 'a tela voltou a formatar o acerto do Motor por conta própria').toBe(true)
    expect(/Math\.round\s*\(\s*motor\.acertoBps/.test(tela), 'ternário no JSX de novo: é onde a guarda anterior ficou cega').toBe(false)
  })
})
