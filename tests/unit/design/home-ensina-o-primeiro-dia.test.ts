import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A home ensina o caminho que faz o produto funcionar NO PRIMEIRO DIA (`docs/82` §16, rodada 21).
 *
 * Medido a 375 px: o "Como começa" terminava em "Atenda. O resto o CICLO acompanha — cada
 * atendimento concluído alimenta o ciclo". É o caminho de semanas. O de um dia existe desde o "Já
 * atendo" (trazer quem já atende, com a última vez de memória) e é o que a visita, o onboarding e
 * a aba Hoje ensinam — a porta de entrada era a única que ensinava a esperar.
 *
 * E a calculadora (`docs/82` §8), a ferramenta grátis que responde à pergunta do próprio `h1`,
 * só aparecia no rodapé.
 */
const copy = semComentarios(readFileSync('src/app/page.tsx', 'utf8'))

function passos(): string {
  const inicio = copy.indexOf('const PASSOS')
  // O fim do array é o `]` sozinho no começo de linha — nunca uma janela de N caracteres.
  const relativo = copy.slice(inicio).search(/\r?\n\]/)
  const fim = relativo === -1 ? copy.length : inicio + relativo
  expect(inicio, 'a lista PASSOS sumiu — a guarda ficaria cega').toBeGreaterThan(-1)
  const trecho = copy.slice(inicio, fim)
  // Controle positivo: sem os três títulos, os testes de ausência passariam vazios.
  expect(trecho.match(/titulo:/g)?.length, 'extrator de PASSOS não achou os passos').toBeGreaterThanOrEqual(3)
  return trecho
}

describe('a home ensina o primeiro dia', () => {
  it('um dos passos é trazer quem já atende, com a última vez', () => {
    const p = passos()
    expect(p).toMatch(/Traga quem você já atende/)
    expect(p, 'o passo precisa dizer que a data é o que faz a lista aparecer').toMatch(/última vez/)
    expect(p).toMatch(/no mesmo dia/)
  })

  it('não ensina a esperar os atendimentos como o caminho para a lista', () => {
    expect(passos()).not.toMatch(/Atenda\. O resto o CICLO acompanha/)
  })

  it('a calculadora aparece antes da primeira seção, não só no rodapé', () => {
    const primeiraSecao = copy.indexOf('O que muda no seu dia')
    const calculadora = copy.indexOf('href="/calculadora"')
    expect(primeiraSecao, 'título da primeira seção mudou — a guarda ficaria cega').toBeGreaterThan(-1)
    expect(calculadora, 'nenhum link para a calculadora').toBeGreaterThan(-1)
    expect(calculadora, 'a calculadora só aparece depois da primeira dobra').toBeLessThan(primeiraSecao)
  })
})
