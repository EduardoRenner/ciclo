import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Toda tela do `/admin` que é Server Component `async` e busca dados (`await`) precisa de um
 * `loading.tsx` irmão.
 *
 * Sem ele, o Next não pinta NADA entre o clique e o Server Component terminar de buscar — numa
 * rede de subsolo isso são segundos de tela imóvel que a pessoa lê como "travou". O projeto já
 * pagou esse defeito uma vez (2026-08-18, `docs/DECISOES.md`) e sistematizou a solução em
 * `src/components/ui/esqueleto-tela.tsx` — mas nada impedia a próxima tela de nascer sem o
 * `loading.tsx`, e foi o que aconteceu com `config/modulos` e `config/meu-plano` (Fase M),
 * pegas só numa varredura manual meses depois.
 *
 * Casa com o que MUDA quando o defeito volta: a combinação `export default async function` + uma
 * chamada `await` no corpo (a busca). Página de `redirect` puro (`admin/page.tsx`) não é `async`
 * e não entra; página estática (sem `await`) também não precisa — o Next já mostra o esqueleto de
 * cliente nesses casos.
 */

const RAIZ = 'src/app/admin'

function paginas(dir: string): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achadas.push(...paginas(caminho))
    else if (entrada.name === 'page.tsx') achadas.push(caminho)
  }
  return achadas
}

/** Server Component `async` que busca dados — a que fica com a tela imóvel sem `loading.tsx`. */
function buscaDados(arquivo: string): boolean {
  const src = readFileSync(arquivo, 'utf8')
  return /export default async function/.test(src) && /\bawait\s/.test(src)
}

const PAGINAS = paginas(RAIZ)
const QUE_BUSCAM = PAGINAS.filter(buscaDados)

describe('toda tela do /admin que busca dados tem loading.tsx', () => {
  it('encontra as telas do painel', () => {
    // Guarda contra passar por não ter achado arquivo nenhum (glob quebrado, pasta movida).
    expect(PAGINAS.length).toBeGreaterThanOrEqual(25)
    expect(QUE_BUSCAM.length).toBeGreaterThanOrEqual(20)
  })

  it.each(QUE_BUSCAM)('%s tem um loading.tsx irmão', (arquivo) => {
    const irmao = join(dirname(arquivo), 'loading.tsx')
    expect(
      existsSync(irmao),
      `${arquivo} é Server Component async com fetch e não tem ${irmao} — a tela fica imóvel entre ` +
        'o clique e o fim da busca. Crie o loading.tsx reusando as peças de components/ui/esqueleto-tela.tsx.',
    ).toBe(true)
  })
})
