import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-122 (docs/98 I-19): "Testar antes de decidir" num mês sem nenhum fechado era um link para uma
 * tela sem base de comparação. O link só pode existir dentro da condição `serie.pontos.length > 0`.
 * Casa com o TRECHO entre a abertura da condição e o seu `) : null` — não com o nome do link solto,
 * que também aparece em comentário e em outras telas.
 */
describe('o Mês só oferece "Testar antes de decidir" com um mês fechado', () => {
  it('o link para /admin/experimentos mora dentro de `serie.pontos.length > 0 ? (`', () => {
    const src = semComentarios(readFileSync('src/app/admin/mes/page.tsx', 'utf8'))
    const ini = src.indexOf('{serie.pontos.length > 0 ? (')
    expect(ini, 'a condição sumiu da página do Mês').toBeGreaterThan(-1)
    const fim = src.indexOf(') : null}', ini)
    expect(fim, 'a condição não fecha com `) : null}`').toBeGreaterThan(ini)
    const dentro = src.slice(ini, fim)
    expect(dentro, 'o link do teste saiu de dentro da condição').toContain('/admin/experimentos')
    expect(src.indexOf('/admin/experimentos', fim), 'há um segundo link do teste fora da condição').toBe(-1)
    expect(src.slice(0, ini)).not.toContain('/admin/experimentos')
  })
})
