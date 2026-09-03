import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A tela de campanhas escrevia "Atendimentos: N **de M mensagens já enviadas**", com N do MÊS e M
 * de TODA a história — `sent_count` somado sobre todas as campanhas, sem filtro de data.
 *
 * Numa conta com 47 mensagens acumuladas e 3 retornos no mês, o salão lia que campanha converte
 * 6%. A campanha que produziu aqueles três retornos pode ter convertido 30%. O produto
 * depreciando a si mesmo por comparar duas janelas diferentes como se fossem uma — e a leitura
 * errada leva à decisão errada: parar de fazer campanha.
 *
 * `mensagensNaJanela` é o denominador da MESMA busca que produziu o numerador. É guarda de
 * varredura porque o defeito não é de comportamento — nenhum valor fica errado isoladamente; o
 * que erra é o PAR.
 */
const PAGINA = join('src', 'app', 'admin', 'campanhas', 'page.tsx')
const SERVICO = join('src', 'server', 'services', 'atribuicao.ts')

const fonte = (p: string) => semComentarios(readFileSync(p, 'utf8'))

/** Quebra de linha por código: escrever '
' dentro deste arquivo confunde o próprio recorte. */
const NL = String.fromCharCode(10)

describe('o par de números da tela de campanhas', () => {
  /**
   * Recorta o bloco `apoio={...}` do cartão "Atendimentos" — o pedaço que de fato desenha o
   * denominador. Delimitar importa: a primeira versão desta guarda casava
   * `/atribuicao\.mensagensNaJanela/` no arquivo INTEIRO e passava com o denominador trocado,
   * porque o nome continuava aparecendo no ternário de singular/plural, uma linha abaixo.
   */
  function apoioDoCartao(src: string): string {
    const i = src.indexOf('apoio={')
    if (i === -1) return ''
    // Fecha na primeira linha que só tem `}` na indentação da prop — não por contagem de chaves,
    // que tropeça nas chaves de interpolação do JSX.
    const fim = src.indexOf(NL + '          }', i)
    return src.slice(i, fim === -1 ? undefined : fim)
  }

  it('o denominador sai da mesma janela do numerador', () => {
    const apoio = apoioDoCartao(fonte(PAGINA))
    expect(apoio.length, 'o cartão "Atendimentos" não tem mais `apoio` — atualize esta guarda').toBeGreaterThan(0)
    expect(apoio, 'o denominador precisa ser `mensagensNaJanela`').toMatch(/atribuicao\.mensagensNaJanela/)
  })

  it('não volta a somar sent_count de todas as campanhas de sempre', () => {
    /*
     * `[\s\S]` e não `[^)]`: a soma é `reduce((s, c) => s + c.sent_count, 0)`, e um `[^)]*` para
     * no primeiro `)` — o da lista de parâmetros da arrow —, então nunca alcança `sent_count`. A
     * primeira versão desta guarda passou com o defeito de volta exatamente por isso.
     *
     * Casa com a SOMA, não com a coluna: `sent_count` sozinho aparece legitimamente nesta tela (o
     * cartão de cada campanha mostra o que AQUELA campanha mandou, que é correto — cartão de
     * campanha é registro permanente, não relatório mensal).
     */
    const src = fonte(PAGINA)
    expect(src, 'somar sent_count de todas as campanhas mistura toda a história com o mês').not.toMatch(
      /reduce\([\s\S]{0,80}?sent_count/,
    )
  })

  it('o serviço devolve o denominador junto, não deixa a tela adivinhar', () => {
    const src = fonte(SERVICO)
    expect(src).toMatch(/mensagensNaJanela:\s*campanhas\.length/)
    // O tipo tem que exigir o campo: `catch` que devolve um objeto sem ele volta a mentir, e foi
    // o `tsc` que achou os dois fallbacks quando o campo virou obrigatório.
    expect(src).toMatch(/mensagensNaJanela:\s*number/)
  })
})
