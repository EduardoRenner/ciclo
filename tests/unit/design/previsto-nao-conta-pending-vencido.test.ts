import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `forecastCents` tem que decidir por `aindaContaComoReceita`, não pela lista crua de estados.
 *
 * A lista `CONTAM_COMO_RECEITA` continua existindo e continua CERTA para a ocupação — a cadeira
 * esteve ocupada por aquele pedido, e isso não muda com o tempo. O que não se sustenta é dinheiro
 * previsto a partir de um `pending` cuja hora já passou: ninguém confirmou, ninguém atendeu.
 *
 * Como os dois cálculos ficam a poucas linhas um do outro e usavam O MESMO filtro, a regressão
 * natural é alguém "simplificar" os dois de volta para a lista. Esta guarda casa com o corpo do
 * `forecastCents` delimitado pelo fim real da expressão, nunca por janela de caracteres — o
 * vizinho (`minutosOcupados`) cairia dentro de uma janela fixa e a guarda passaria pelo motivo
 * errado.
 */
const SERVICO = join('src', 'server', 'services', 'agendamentos.ts')

function corpoDoForecast(): string {
  const src = semComentarios(readFileSync(SERVICO, 'utf8'))
  const inicio = src.indexOf('const forecastCents =')
  if (inicio === -1) throw new Error('`const forecastCents =` sumiu de agendamentos.ts — a guarda perdeu o alvo')
  // Fim real da expressão: o `;` implícito é a próxima linha em branco seguida de `  return`.
  const fim = src.indexOf('\n\n', inicio)
  return src.slice(inicio, fim === -1 ? undefined : fim)
}

describe('o previsto do dia não conta pedido vencido', () => {
  it('forecastCents decide por aindaContaComoReceita', () => {
    expect(corpoDoForecast()).toMatch(/aindaContaComoReceita\s*\(/)
  })

  it('forecastCents NÃO volta a filtrar pela lista crua de estados', () => {
    expect(corpoDoForecast()).not.toMatch(/CONTAM_COMO_RECEITA/)
  })

  it('a ocupação continua usando a lista crua — ela não decai com o tempo', () => {
    const src = semComentarios(readFileSync(SERVICO, 'utf8'))
    const inicio = src.indexOf('const minutosOcupados =')
    expect(inicio).toBeGreaterThan(-1)
    expect(src.slice(inicio, src.indexOf('\n\n', inicio))).toMatch(/CONTAM_COMO_RECEITA/)
  })
})
