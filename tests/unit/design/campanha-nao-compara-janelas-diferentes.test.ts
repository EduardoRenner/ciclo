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

describe('o par de números da tela de campanhas', () => {
  it('o denominador sai da mesma janela do numerador', () => {
    const src = fonte(PAGINA)
    expect(src, 'o apoio do cartão precisa usar `mensagensNaJanela`').toMatch(/atribuicao\.mensagensNaJanela/)
  })

  it('não volta a somar sent_count de todas as campanhas de sempre', () => {
    /*
     * Casa com a SOMA, não com a coluna: `sent_count` sozinho aparece legitimamente em outros
     * lugares desta tela (o cartão de cada campanha mostra o que aquela campanha mandou, que é
     * correto — cartão de campanha é registro permanente, não relatório mensal).
     */
    const src = fonte(PAGINA)
    expect(src, 'somar sent_count de todas as campanhas mistura toda a história com o mês').not.toMatch(
      /reduce\([^)]*sent_count/,
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
