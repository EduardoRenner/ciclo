import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/82` §6 — os dois laços de distribuição que o produto já tinha precisam dizer de onde a
 * pessoa veio.
 *
 * Até 2026-09-23 o selo "Feito com CICLO" (página de cada negócio) e o convite de colega ("Meu
 * plano") apontavam para a raiz pelada. Uma conta criada por eles era indistinguível de uma criada
 * do nada, e o placar de distribuição nunca mostraria o único canal grátis que o CICLO tem. O
 * defeito é silencioso por natureza: o link continua funcionando, só a atribuição some.
 */

const raiz = join(__dirname, '..', '..', '..')
const ler = (rel: string) => semComentarios(readFileSync(join(raiz, rel), 'utf8'))

describe('laços de distribuição carregam origem', () => {
  it('o selo "Feito com CICLO" leva origem=selo e o slug do negócio', () => {
    const fonte = ler('src/app/(public)/[slug]/secoes.tsx')
    const inicio = fonte.indexOf('Feito com')
    // Guarda do detector: se o texto mudar, a guarda tem que gritar, não passar vazia.
    expect(inicio, 'o selo "Feito com" sumiu de secoes.tsx — atualize esta guarda').toBeGreaterThan(-1)
    const fim = fonte.indexOf('</footer>', inicio)
    expect(fim).toBeGreaterThan(inicio)
    const selo = fonte.slice(inicio, fim)

    expect(selo).toContain("linkComOrigem('/', 'selo', perfil.slug)")
    expect(selo).not.toMatch(/href="\/"/)
  })

  it('o convite de colega leva origem=convite e o slug de quem indicou', () => {
    const fonte = ler('src/app/admin/config/meu-plano/page.tsx')
    const chamadas = fonte.split('textoDoConviteDoCiclo(').slice(1)
    expect(chamadas.length, 'o convite sumiu de meu-plano — atualize esta guarda').toBeGreaterThan(0)

    for (const chamada of chamadas) {
      // Até o fim do objeto de argumentos da chamada.
      const argumentos = chamada.slice(0, chamada.indexOf('})'))
      expect(argumentos).toContain("linkComOrigem(APP_URL, 'convite', ctx.tenant.slug)")
      expect(argumentos).not.toMatch(/url:\s*APP_URL\s*[,}]/)
    }
  })

  it('o convite no pico ("o Motor trouxe", em Hoje) leva origem=convite e o slug do negócio', () => {
    const fonte = ler('src/app/admin/hoje/hoje.tsx')
    const chamadas = fonte.split('textoDoConviteDoCiclo(').slice(1)
    expect(chamadas.length, 'o convite sumiu de hoje.tsx — atualize esta guarda').toBeGreaterThan(0)
    for (const chamada of chamadas) {
      const argumentos = chamada.slice(0, chamada.indexOf('})'))
      expect(argumentos).toContain("linkComOrigem(APP_URL, 'convite', site.slug)")
    }
  })
})
