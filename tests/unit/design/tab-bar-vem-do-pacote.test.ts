import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PACOTES } from '@/core/pacotes'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/101 T0.3. A barra é do pacote; o defeito que esta guarda pega é a barra voltar a ser fixa
 * em algum ponto da costura: o `TabBar` lendo `ABAS`/`HREF_DO_CENTRO` direto (o escritório veria a
 * barra do salão), um rótulo do centro escrito à mão ("Recuperar receita" no escritório), ou o
 * layout deixar de passar o pacote do tenant.
 *
 * Casa com o USO, nunca com o nome solto: `semComentarios` antes, e padrões que só existem na
 * chamada (`PACOTES[pacote]`, `pacote={ctx?.tenant.pacote`).
 */
const TAB_BAR = semComentarios(readFileSync('src/components/shell/tab-bar.tsx', 'utf8'))
const LAYOUT = semComentarios(readFileSync('src/app/admin/layout.tsx', 'utf8'))

describe('o TabBar lê a barra do pacote', () => {
  it('não importa ABAS nem HREF_DO_CENTRO', () => {
    expect(/import[^;]*\b(ABAS|HREF_DO_CENTRO)\b[^;]*from '\.\/tabs'/.test(TAB_BAR), 'o TabBar voltou a ler a barra fixa').toBe(false)
  })

  it('resolve abas e centro por PACOTES[pacote]', () => {
    expect(/const \{ abas, centro \} = PACOTES\[pacote\]/.test(TAB_BAR), 'o TabBar não resolve a barra pelo pacote').toBe(true)
  })

  it('nenhum rótulo de centro escrito à mão', () => {
    for (const p of Object.values(PACOTES)) {
      expect(TAB_BAR.includes(p.centro.rotulo), `"${p.centro.rotulo}" literal no TabBar`).toBe(false)
    }
    expect(/aria-label=\{centro\.rotulo\}/.test(TAB_BAR)).toBe(true)
  })

  it('o layout passa o pacote do tenant', () => {
    expect(/<TabBar pacote=\{ctx\?\.tenant\.pacote \?\? 'base'\} \/>/.test(LAYOUT), 'o layout deixou de passar o pacote').toBe(true)
  })
})

describe('as rotas do centro e das abas do pacote existem', () => {
  it.each(Object.values(PACOTES).flatMap((p) => [...p.abas, p.centro].map((a) => [p.slug, a.href] as const)))(
    '%s: %s tem page.tsx e loading.tsx',
    (_slug, href) => {
      const pasta = `src/app${href}`
      expect(() => readFileSync(`${pasta}/page.tsx`, 'utf8'), `${pasta}/page.tsx não existe`).not.toThrow()
      expect(() => readFileSync(`${pasta}/loading.tsx`, 'utf8'), `${pasta}/loading.tsx não existe`).not.toThrow()
    },
  )

  it('as telas próprias do pacote advocacia recusam outro pacote com 404', () => {
    for (const rota of ['casos', 'pendencias']) {
      const fonte = semComentarios(readFileSync(`src/app/admin/${rota}/page.tsx`, 'utf8'))
      expect(/if \(ctx\.tenant\.pacote !== 'advocacia'\) notFound\(\)/.test(fonte), `${rota} abre para salão`).toBe(true)
    }
  })
})
