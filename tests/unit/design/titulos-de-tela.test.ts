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
/*
 * `(public)` entrou na rodada 4: as quatro telas por token (avaliar, confirmar, lista-espera,
 * orçamento) tinham ficado de fora da primeira correção e voltaram a herdar "CICLO". São as
 * telas que a cliente abre pelo link do WhatsApp — as únicas que muita gente vai ver do produto.
 */
const RAIZES = ['src/app/admin', 'src/app/(auth)', 'src/app/onboarding', 'src/app/(public)']

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
    expect(TODAS.length).toBeGreaterThanOrEqual(36)
  })

  it.each(TODAS)('%s declara um título', (arquivo) => {
    const src = readFileSync(arquivo, 'utf8')

    // `/admin/page.tsx` é só um `redirect`, não chega a pintar tela nem título.
    if (/^\s*redirect\(/m.test(src) && !/export default async/.test(src)) return

    // `[^}]*?` preguiçoso, não guloso: com `[^}]*` a busca ia até o ÚLTIMO `title:` antes da
    // primeira `}`, o que numa página com `openGraph` capturava o título social em vez do título
    // do documento — e então reprovava por "repete a marca" um título de tela que estava certo.
    // Achado ao criar `/precos`, a primeira página do projeto com openGraph e título próprio.
    const estatico = /export const metadata\s*=\s*\{[^}]*?title:\s*['"]([^'"]+)['"]/.exec(src)
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

  /*
   * As RAIZES acima procuram `page.tsx` dentro de quatro pastas, e por isso deixavam de fora a
   * tela que TODO link quebrado do produto entrega — inclusive os que circulam no WhatsApp de
   * cliente de salão. Medido no navegador em 2026-09-03: o `<title>` do 404 era só "CICLO",
   * herdado do `default` do layout, exatamente o defeito que este arquivo existe para pegar.
   */
  it('o 404 declara título próprio — é a tela de todo link quebrado', () => {
    const src = readFileSync('src/app/not-found.tsx', 'utf8')
    const titulo = /export const metadata\s*=\s*\{[^}]*?title:\s*['"]([^'"]+)['"]/.exec(src)
    expect(titulo?.[1]?.trim(), 'src/app/not-found.tsx não declara metadata.title').toBeTruthy()
    // Mesma regra das outras: repetir a marca cancelaria o `template` do layout raiz.
    expect(titulo![1]!.toLowerCase()).not.toContain('ciclo')
  })

  it('`error.tsx` fica de fora, e o motivo é técnico', () => {
    /*
     * Guarda contra alguém "completar" a regra acrescentando `error.tsx` aqui: ele é `'use
     * client'` por exigência do Next, e Client Component não exporta `metadata`. Exigir título
     * dali seria uma guarda impossível de satisfazer — e a saída seria removê-la, levando junto a
     * asserção do 404 que É satisfazível.
     */
    expect(readFileSync('src/app/error.tsx', 'utf8')).toMatch(/^'use client'/)
  })
})
