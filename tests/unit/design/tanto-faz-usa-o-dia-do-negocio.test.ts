import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-223 (docs/98 R-33): com "Tanto faz" de profissional, o agendamento público procura o horário
 * na disponibilidade DO DIA — e o dia era `startsAt.slice(0, 10)`, o dia em UTC. Às 21h de Brasília
 * já é amanhã em UTC: a lista era a de outro dia e a resposta, 409. O dia tem que vir de
 * `diaNoFuso(tenant.timezone, …)`. Casa com a CHAMADA a `disponibilidadePublica(` dentro do serviço.
 */
describe('"Tanto faz" procura o horário no dia do negócio (APR-223)', () => {
  it('a chamada a disponibilidadePublica no agendamento público usa diaNoFuso, não slice(0, 10)', () => {
    const src = semComentarios(readFileSync('src/server/services/public-booking.ts', 'utf8'))
    const i = src.indexOf('export async function criarAgendamentoPublico')
    expect(i).toBeGreaterThan(-1)
    const corpo = src.slice(i, src.indexOf('export async function', i + 10) > 0 ? src.indexOf('export async function', i + 10) : undefined)
    const chamada = /disponibilidadePublica\(([^)]*)\)/.exec(corpo)
    expect(chamada, 'o agendamento público deixou de consultar a disponibilidade').not.toBeNull()
    expect(chamada![1]).toMatch(/diaNoFuso\(tenant\.timezone/)
    expect(chamada![1]).not.toMatch(/slice\(0, 10\)/)
  })
})
