import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SLUGS_DE_DEMONSTRACAO } from '@/core/tenants/demonstracao'

import { semComentarios } from '../../helpers/fonte'

/**
 * `scripts/seed-demo-dinheiro.mjs` apaga todas as comandas, itens e pagamentos do tenant antes de recriar. Até 16/10 ele
 * aceitava qualquer slug: um negócio de verdade digitado por engano perdia o caixa (regra 11 do CLAUDE.md). Mesma trava
 * de `agenda-futura-so-demonstracao`.
 */
const fonte = semComentarios(readFileSync('scripts/seed-demo-dinheiro.mjs', 'utf8'))
const lista = /const SLUGS_DE_DEMONSTRACAO = \[([^\]]*)\]/.exec(fonte)?.[1] ?? ''
const doScript = [...lista.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]!)

describe('camada de dinheiro só em conta de demonstração', () => {
  it('a lista do script foi lida (piso pelo positivo conhecido)', () => {
    expect(doScript).toContain('apple-review')
  })

  it('é a mesma lista do produto (demonstracao.ts)', () => {
    expect([...doScript].sort()).toEqual([...SLUGS_DE_DEMONSTRACAO].sort())
  })

  it('slug de fora da lista é recusado antes de qualquer escrita', () => {
    const recusa = fonte.indexOf('alvo.filter((s) => !SLUGS_DE_DEMONSTRACAO.includes(s))')
    const apaga = fonte.indexOf('.delete(')
    expect(recusa, 'sumiu a recusa de slug que não é demonstração').toBeGreaterThan(-1)
    expect(apaga).toBeGreaterThan(-1)
    expect(recusa, 'a recusa vem depois de apagar').toBeLessThan(apaga)
    expect(fonte).toMatch(/if \(foraDaDemonstracao\.length\) precisa\(/)
  })
})
