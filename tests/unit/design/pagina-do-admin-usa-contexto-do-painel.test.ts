import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * `docs/DECISOES.md` 2026-09-16 — o conserto de `admin/layout.tsx` (redireciona pro onboarding
 * quando `contextoAtual` lança `FORBIDDEN`, conta sem estabelecimento) só protegia o LAYOUT. Toda
 * `page.tsx` sob `/admin` chamava `contextoAtual` de novo, sem tratar o mesmo erro — e em
 * navegação client-side o Next.js pode buscar o segmento da página sem re-executar o layout já
 * montado no navegador, deixando o `FORBIDDEN` sem ninguém tratando. Medido em produção: 1
 * ocorrência em `/admin/config`, NO DEPLOY que já tinha o conserto do layout.
 *
 * `contextoDoPainel` (`server/auth/tenant.ts`) é o mesmo `contextoAtual` com esse tratamento
 * embutido. Esta guarda varre TODA `page.tsx` sob `src/app/admin` (exceto o layout, que trata o
 * erro com uma regra própria — `null`/vocabulário padrão em vez de sempre relançar) e reprova se
 * alguma delas voltar a chamar `contextoAtual` direto, sem passar pelo wrapper.
 */
const RAIZ = 'src/app/admin'

function paginas(dir: string): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achadas.push(...paginas(caminho))
    else if (entrada.name === 'page.tsx') achadas.push(caminho.replace(/\\/g, '/'))
  }
  return achadas
}

const PAGINAS = paginas(RAIZ)

describe('toda page.tsx do /admin usa contextoDoPainel, não contextoAtual direto', () => {
  it('encontra as páginas do painel — não pode passar por não ter achado nenhuma', () => {
    expect(PAGINAS.length).toBeGreaterThanOrEqual(25)
  })

  const comChamada = PAGINAS.filter((p) => semComentarios(readFileSync(p, 'utf8')).includes('contextoAtual('))

  it('nenhuma page.tsx chama contextoAtual() direto', () => {
    expect(
      comChamada,
      `${comChamada.join(', ')}: chama contextoAtual() direto — use contextoDoPainel() de ` +
        '@/server/auth/tenant, senão FORBIDDEN (conta sem estabelecimento) vira erro na tela em ' +
        'vez de redirecionar pro onboarding.',
    ).toEqual([])
  })

  it('o detector reconhece o defeito que ele impede', () => {
    const semWrapper = "const ctx = await contextoAtual(new Request('https://interno/x', { headers }))"
    expect(semComentarios(semWrapper).includes('contextoAtual(')).toBe(true)
  })
})
