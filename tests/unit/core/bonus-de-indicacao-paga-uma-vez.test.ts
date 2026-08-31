import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { deveCreditarIndicacao } from '@/core/loyalty/indicacao'

/*
 * Sem os comentarios. A primeira versao desta guarda reprovou casando com `visits_count` dentro do
 * COMENTARIO que explica justamente por que nao usar mais `visits_count` — a armadilha nº1 da
 * tabela do CLAUDE.md ("casa com algo que o arquivo contem por outro motivo"), e a segunda vez que
 * ela me pega hoje: a mesma coisa aconteceu com "R$ 49" dentro do comentario do llms.txt.
 */

const NL = String.fromCharCode(10)
const FIDELIDADE = semComentarios(readFileSync('src/server/services/fidelidade.ts', 'utf8'))

/**
 * O bonus de indicacao era decidido por `clients.visits_count === 0`. Esse contador so e escrito
 * pelo cron `segments`, uma vez por dia e com 5-6h de atraso medido — entao ele continua `0` na
 * SEGUNDA conclusao da mesma cliente, e na terceira, ate o cron rodar. Duas conclusoes no mesmo
 * dia (corte e barba marcados separados) pagavam o bonus duas vezes, para ela e para quem indicou.
 *
 * Ponto de fidelidade e resgatavel: e dinheiro saindo por engano, e do jeito mais dificil de
 * perceber, porque o extrato mostra dois lancamentos iguais e nada acusa.
 */
describe('bonus de indicacao paga UMA vez', () => {
  const base = { bonusPoints: 20, referredBy: 'quem-indicou', bonusJaCreditado: false }

  it('primeira conclusao de quem veio por indicacao: credita', () => {
    expect(deveCreditarIndicacao(base)).toBe(true)
  })

  it('SEGUNDA conclusao: nao credita de novo', () => {
    // O caso do defeito. Antes, o contador defasado dizia "ainda e a primeira" e pagava de novo.
    expect(deveCreditarIndicacao({ ...base, bonusJaCreditado: true }), 'pagou o bonus duas vezes').toBe(false)
  })

  it('quem nao veio por indicacao nunca credita', () => {
    expect(deveCreditarIndicacao({ ...base, referredBy: null })).toBe(false)
    expect(deveCreditarIndicacao({ ...base, referredBy: null, bonusJaCreditado: true })).toBe(false)
  })

  it('bonus zerado desliga a regra — nao lanca linha de zero ponto', () => {
    expect(deveCreditarIndicacao({ ...base, bonusPoints: 0 })).toBe(false)
  })
})

describe('a decisao nao volta a depender do contador do cron', () => {
  it('o servico NAO le visits_count para decidir a indicacao', () => {
    // Casa com a leitura em si, em qualquer lugar do arquivo — sem janela de N caracteres, que foi
    // como a guarda das metricas da ficha nasceu cega mais cedo hoje.
    expect(FIDELIDADE, 'voltou a inferir "primeira visita" de um contador que so muda uma vez por dia').not.toContain(
      'visits_count',
    )
  })

  it('o servico consulta o livro-razao pelo motivo, que e a chave de idempotencia', () => {
    expect(FIDELIDADE).toContain('MOTIVO_VEIO_POR_INDICACAO')
    expect(FIDELIDADE).toContain('deveCreditarIndicacao(')
  })
})
