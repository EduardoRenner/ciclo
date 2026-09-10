import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O `CLAUDE.md` manda subir o banco local antes do `pnpm dev`. O `supabase start` escreve o
 * bootstrap do edge runtime em `supabase/.temp/`, e esse diretório estava no `.gitignore` desde
 * sempre — mas não no ignore do ESLint.
 *
 * Resultado medido em 2026-09-10: 154 erros de lint em código que não é nosso, e como `pnpm verify`
 * roda lint, **seguir o setup documentado do projeto reprovava o próprio portão de pré-commit**.
 *
 * A CI nunca viu, e é isso que torna a classe cara: `qualidade` (typecheck + lint) e `Banco e RLS`
 * (que roda `supabase start`) são jobs separados, em contêineres separados. Verde no CI, vermelho
 * na máquina de quem desenvolve — a direção mais cara de um falso verde, porque ninguém que possa
 * consertar está olhando.
 *
 * Esta guarda cobra que as duas listas concordem sobre o que o banco local gera.
 */

const GITIGNORE = readFileSync('.gitignore', 'utf8')
const ESLINT = readFileSync('eslint.config.mjs', 'utf8')

/** O que o `supabase start`/`supabase db reset` escrevem e nunca é código do projeto. */
const GERADOS_PELO_BANCO_LOCAL = ['supabase/.temp', 'supabase/.branches']

describe('pnpm verify sobrevive ao banco local rodando', () => {
  it('as duas leituras não voltaram vazias', () => {
    // Piso: um arquivo vazio faria todas as afirmações abaixo passarem sem conferir nada.
    expect(GITIGNORE.length).toBeGreaterThan(200)
    expect(ESLINT).toContain('ignores')
    expect(ESLINT).toContain('node_modules')
  })

  it.each(GERADOS_PELO_BANCO_LOCAL)('%s está no .gitignore', (caminho) => {
    expect(GITIGNORE).toContain(caminho)
  })

  it('e supabase/.temp também está no ignore do ESLint', () => {
    /*
      Só este é cobrado do ESLint, e a assimetria é deliberada: `supabase/.temp` é o único que o
      `supabase start` enche de `.ts`. Cobrar `.branches` aqui seria guarda sem defeito por trás.
    */
    expect(
      ESLINT,
      'o `supabase start` escreve .ts em supabase/.temp; sem este ignore, `pnpm verify` reprova em ' +
        'toda máquina que seguiu o setup do CLAUDE.md, e a CI não avisa porque lint e banco rodam ' +
        'em jobs separados.',
    ).toContain('supabase/.temp')
  })

  it('o portão de pré-commit continua sendo o que a documentação promete', () => {
    // Se `verify` deixar de rodar lint, esta guarda inteira vira decorativa e ninguém percebe.
    const pacote = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    expect(pacote.scripts.verify, '`pnpm verify` parou de rodar lint').toContain('lint')
  })
})
