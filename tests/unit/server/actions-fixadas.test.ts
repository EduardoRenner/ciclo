import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Achado S14 da auditoria de 2026-08-23: as actions de terceiro estavam presas em tag móvel
 * (`@v4`, `@v1`). Tag é ponteiro: quem controla o repositório da action pode reapontá-la para
 * outro código, e o runner executa isso sobre este repositório.
 *
 * O que só apareceu ao corrigir: `supabase/setup-cli@v1` **não era uma tag** — era um branch
 * (`refs/heads/v1`), que se move a cada push. Pior que tag, e com a mesma cara de versão fixa.
 */

const DIR = join('.github', 'workflows')
const SHA = /^[0-9a-f]{40}$/

const linhas = readdirSync(DIR)
  .filter((f) => /\.ya?ml$/.test(f))
  .flatMap((f) =>
    readFileSync(join(DIR, f), 'utf8')
      .split('\n')
      .map((linha, i) => ({ arquivo: f, numero: i + 1, texto: linha.trim() })),
  )
  .filter((l) => l.texto.startsWith('- uses:') || l.texto.startsWith('uses:'))

describe('actions de terceiro (achado S14)', () => {
  it('o leitor acha os workflows', () => {
    // Guarda contra o teste passar por não ter olhado nada.
    expect(linhas.length).toBeGreaterThanOrEqual(4)
  })

  it('toda action é fixada por SHA de commit, nunca por tag ou branch', () => {
    const moveis = linhas
      .map((l) => ({ ...l, ref: l.texto.replace(/^-?\s*uses:\s*/, '').split('#')[0]!.trim().split('@')[1] }))
      // `./caminho` e `docker://` não têm `@ref` — não são action de terceiro versionada.
      .filter((l) => l.ref !== undefined && !SHA.test(l.ref))
      .map((l) => `${l.arquivo}:${l.numero} → ${l.texto}`)

    expect(
      moveis,
      'Action presa em ref móvel. Pegue o SHA com `git ls-remote <url> refs/tags/<tag> refs/tags/<tag>^{}` ' +
        '(prefira o de `^{}`, que é o commit) e deixe a versão no comentário ao lado.',
    ).toEqual([])
  })

  it('cada SHA vem com a versão legível no comentário', () => {
    // SHA sem comentário é indecifrável na revisão: ninguém sabe se `11d5960` é v3 ou v4.
    const semComentario = linhas.filter((l) => /@[0-9a-f]{40}/.test(l.texto) && !l.texto.includes('#')).map((l) => l.texto)
    expect(semComentario).toEqual([])
  })
})
