import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `X-Powered-By: Next.js` sai em toda resposta enquanto `poweredByHeader` não for `false`. Não é
 * vulnerabilidade, é ajuda de graça para quem varre a internet procurando qual CVE tentar.
 * Medido em produção em 2026-09-21. A guarda casa com a PROPRIEDADE no config, não com a palavra
 * `poweredByHeader` (que também aparece no comentário que explica por que ela existe).
 */
describe('next.config: não anuncia a stack', () => {
  const config = semComentarios(readFileSync('next.config.ts', 'utf8'))

  it('a leitura não voltou vazia', () => {
    expect(config.length).toBeGreaterThan(300)
  })

  it('poweredByHeader está desligado', () => {
    expect(config).toMatch(/poweredByHeader\s*:\s*false/)
  })

  it('o detector reconhece o defeito que ele impede', () => {
    expect(/poweredByHeader\s*:\s*false/.test('const nextConfig = { poweredByHeader: true }')).toBe(false)
    expect(/poweredByHeader\s*:\s*false/.test('const nextConfig = {}')).toBe(false)
  })
})
