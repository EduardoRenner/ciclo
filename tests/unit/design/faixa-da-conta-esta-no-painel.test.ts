import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A faixa de cortesia (docs/87 §3.1) só protege alguém se aparecer em TODA tela do painel, e ela
 * vive em três peças que podem se soltar sem nenhuma dar erro: a consulta que traz o plano, o
 * cálculo da faixa e o componente no layout. Se alguém tira a chamada do layout, o painel segue
 * verde e a pessoa descobre que a cortesia acabou pela pausa, que é exatamente o que a faixa existe
 * para evitar.
 *
 * Casa com a CHAMADA e com o JSX, nunca com o nome solto, que aparece também na linha de `import`.
 */
const LAYOUT = semComentarios(readFileSync('src/app/admin/layout.tsx', 'utf8'))
const TENANT = semComentarios(readFileSync('src/server/auth/tenant.ts', 'utf8'))

describe('a faixa da conta está ligada no painel', () => {
  it('o layout calcula a faixa a partir da situação da conta', () => {
    expect(LAYOUT).toMatch(/faixaDaConta\(\s*situacaoDaConta\(/)
    // O plano pago vem normalizado, nunca o texto cru do banco.
    expect(LAYOUT).toMatch(/normalizarPlano\(ctx\.tenant\.plan\)/)
    expect(LAYOUT).toMatch(/lerCortesia\(\{ cortesia: ctx\.tenant\.cortesia \}\)/)
  })

  it('o layout RENDERIZA a faixa quando ela existe', () => {
    expect(LAYOUT).toMatch(/\{faixa \? <FaixaDaConta faixa=\{faixa\} \/> : null\}/)
  })

  it('o plano e a cortesia chegam na MESMA consulta que valida o vínculo, sem ida extra ao banco', () => {
    expect(TENANT).toMatch(/\.from\('memberships'\)[\s\S]*?\.select\([^)]*\bplan\b[^)]*cortesia:settings->cortesia[^)]*\)/)
    // `settings` inteiro continua de fora: é jsonb que cresce por tenant.
    expect(TENANT).not.toMatch(/tenants\([^)]*\bsettings\b(?!->)[^)]*\)/)
  })

  it('o detector enxerga o cenário: sem a consulta de membership, esta guarda grita em vez de passar vazia', () => {
    expect(TENANT.includes(".from('memberships')"), 'a consulta mudou de forma: reescreva a guarda').toBe(true)
  })
})
