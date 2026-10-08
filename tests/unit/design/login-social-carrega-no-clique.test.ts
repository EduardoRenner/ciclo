import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/102 M4.1: `login-social.tsx` importava o cliente Supabase do navegador no topo do módulo. `/entrar` e
 * `/cadastro` eram as rotas mais pesadas do produto (208 e 209 kB no primeiro carregamento, o dobro da base),
 * mesmo sem provedor ligado, quando o bloco nem aparece. Importado no clique: 141 e 142 kB (`pnpm build`).
 */
const fonte = semComentarios(readFileSync('src/app/(auth)/login-social.tsx', 'utf8'))

describe('login social carrega o cliente Supabase só no clique', () => {
  it('não há importação estática do cliente do navegador', () => {
    expect(fonte).not.toMatch(/^import[^\n]*['"]@\/server\/db\/browser-client['"]/m)
  })

  it('a importação é dinâmica, dentro da ação', () => {
    expect(fonte).toMatch(/await import\(['"]@\/server\/db\/browser-client['"]\)/)
    expect(fonte.indexOf("await import('@/server/db/browser-client')")).toBeGreaterThan(fonte.indexOf('async function entrarCom('))
  })
})
