import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ehDemonstracao } from '@/core/tenants/demonstracao'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/101 anexo 06 §4: o escritório-modelo mostra em toda tela que é fictício. A faixa mora no layout
 * do painel; esta guarda casa com a CHAMADA que decide (`ehDemonstracao(ctx.tenant.slug)`) e com a
 * frase inteira, fora de comentário, e confere que o slug do gerador está na lista.
 */
const LAYOUT = semComentarios(readFileSync('src/app/admin/layout.tsx', 'utf8'))

describe('escritório-modelo tem a faixa de demonstração', () => {
  it('o slug do gerador é demonstração', () => {
    expect(ehDemonstracao('demo-alvorada-advocacia')).toBe(true)
    const gerador = readFileSync('scripts/seed-demo-escritorio.mjs', 'utf8')
    expect(gerador).toContain("const SLUG = 'demo-alvorada-advocacia'")
  })

  it('o layout decide pela chamada e mostra a frase 40', () => {
    expect(LAYOUT).toMatch(/ctx\?\.tenant\.pacote === 'advocacia' && ehDemonstracao\(ctx\.tenant\.slug\)/)
    expect(LAYOUT).toContain('Dados fictícios de demonstração. Nenhuma pessoa, empresa ou processo aqui existe.')
  })
})
