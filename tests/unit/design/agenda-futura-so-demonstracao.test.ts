import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SLUGS_DE_DEMONSTRACAO } from '@/core/tenants/demonstracao'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/102 M2.1: `scripts/seed-demo-agenda-futura.mjs` APAGA agendamentos futuros e recria a agenda das contas
 * de demonstração (sem ele, Hoje e Agenda abrem vazios duas semanas depois do gerador). Medido em 2026-10-08:
 *  - aceitava qualquer slug na linha de comando, inclusive de um salão de verdade;
 *  - a lista padrão tinha 7 das 13 contas: os seis salões `demo-*` nunca eram renovados.
 */
const fonte = semComentarios(readFileSync('scripts/seed-demo-agenda-futura.mjs', 'utf8'))
const lista = /const SLUGS = \[([^\]]*)\]/.exec(fonte)?.[1] ?? ''
const doScript = [...lista.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!)

describe('agenda futura só em conta de demonstração', () => {
  it('a lista do script foi lida (piso pelo positivo conhecido)', () => {
    expect(doScript).toContain('demo-salao-encanto')
    expect(doScript.length).toBeGreaterThanOrEqual(13)
  })

  it('é a mesma lista do produto (demonstracao.ts), nem mais nem menos', () => {
    expect([...doScript].sort()).toEqual([...SLUGS_DE_DEMONSTRACAO].sort())
  })

  it('slug de fora da lista é recusado antes de qualquer escrita', () => {
    const recusa = fonte.indexOf('alvo.filter((s) => !SLUGS.includes(s))')
    const apaga = fonte.indexOf('.delete(')
    expect(recusa, 'sumiu a recusa de slug que não é demonstração').toBeGreaterThan(-1)
    expect(apaga).toBeGreaterThan(-1)
    expect(recusa, 'a recusa vem depois de apagar').toBeLessThan(apaga)
    expect(fonte).toMatch(/if \(foraDaDemonstracao\.length\) precisa\(/)
  })
})
