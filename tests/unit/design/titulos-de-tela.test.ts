import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * As 29 telas de `/admin` herdavam o mesmo `<title>` ("CICLO") porque nenhuma
 * exportava `metadata` — medido em 2026-08-23 (`docs/15-AUDITORIA-DESIGN-UX.md`
 * A1). Isso não é SEO: `/admin` nem é indexável. No App Router a navegação é no
 * cliente, e o `<title>` é o que o leitor de tela anuncia quando a rota troca —
 * com o mesmo texto em todas, quem não enxerga não recebe confirmação nenhuma
 * de que saiu do lugar (WCAG 2.4.2).
 *
 * O teste lê os arquivos de verdade em vez de uma lista copiada: tela nova nasce
 * reprovando até ganhar título, que é a única forma de o defeito não voltar.
 */
const RAIZES = ['src/app/admin', 'src/app/(auth)', 'src/app/onboarding']

function paginas(dir: string): string[] {
  const achadas: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achadas.push(...paginas(caminho))
    else if (entrada.name === 'page.tsx') achadas.push(caminho)
  }
  return achadas
}

const TODAS = RAIZES.flatMap(paginas)

describe('título próprio por tela', () => {
  it('encontra as páginas do app do profissional', () => {
    // Guarda contra o teste passar por não ter achado arquivo nenhum.
    expect(TODAS.length).toBeGreaterThanOrEqual(30)
  })

  it.each(TODAS)('%s declara um título', (arquivo) => {
    const src = readFileSync(arquivo, 'utf8')

    // `/admin/page.tsx` é só um `redirect`, não chega a pintar tela nem título.
    if (/^\s*redirect\(/m.test(src) && !/export default async/.test(src)) return

    const estatico = /export const metadata\s*=\s*\{[^}]*title:\s*['"]([^'"]+)['"]/.exec(src)
    const dinamico = /export async function generateMetadata/.test(src)

    expect(
      Boolean(estatico?.[1]?.trim()) || dinamico,
      `${arquivo} não exporta metadata.title nem generateMetadata`,
    ).toBe(true)

    // Título que repete a marca cancela o `template` do layout raiz.
    if (estatico?.[1]) expect(estatico[1].toLowerCase()).not.toContain('ciclo')
  })

  it('o layout raiz junta o título da tela à marca', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8')
    expect(layout).toMatch(/template:\s*['"]%s · CICLO['"]/)
  })
})
