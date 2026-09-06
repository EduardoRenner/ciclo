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
   * `acertoBps` é `null` enquanto não há previsão conferida, e `null` não é zero: dizer "o Motor
   * acertou 0%" de um salão que ainda não teve previsão fechada acusa o produto de um erro que ele
   * não cometeu. É a mesma regra que fez `taxaEstaConfigurada` existir.
   */
  it('sem amostra, o acerto do Motor não vira zero por cento', () => {
    expect(/acertoBps\s*===\s*null/.test(tela), 'a tela deixou de separar "sem amostra" de "zero"').toBe(true)
  })
})
