import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { APP_HOST, APP_URL } from '@/lib/app-url'

/**
 * O domínio do produto já esteve escrito em SEIS lugares — `metadataBase`, `robots.ts`,
 * `sitemap.ts`, `llms.txt`, e dois campos de tela (`onboarding`, `config/negocio`) que mostravam
 * `ciclo.app/` para o usuário. `ciclo.app` nunca foi registrado: quem digitasse aquilo de memória
 * na bio do Instagram publicava um link morto.
 *
 * Agora mora só em `src/lib/app-url.ts`. Esta guarda mantém assim — mesma regra de
 * `preco-em-um-lugar-so`: literal de domínio que aparece em dois lugares um dia diverge, e o lugar
 * onde ninguém olha é o que fica errado.
 *
 * Casa com o que MUDA quando o defeito volta: (1) a string `ciclo.app` reaparecendo em qualquer
 * lugar, (2) um novo `?? 'https://…'` inline (o padrão exato que foi consolidado), (3) o literal
 * `seuciclo` fora do arquivo canônico.
 */

const RAIZ = 'src'
const ARQUIVO_CANONICO = join('src', 'lib', 'app-url.ts')

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.(ts|tsx)$/.test(entrada.name)) achados.push(caminho)
  }
  return achados
}

const TODOS = arquivos(RAIZ)

describe('o domínio do produto mora num arquivo só', () => {
  it('o leitor enxerga a árvore de src/ — não passa por não ter olhado nada', () => {
    expect(TODOS.length).toBeGreaterThan(80)
    expect(TODOS).toContain(ARQUIVO_CANONICO)
  })

  it('`ciclo.app` — o domínio morto — não aparece em lugar nenhum de src/', () => {
    // `app-url.ts` cita `ciclo.app` no comentário, contando por que a consolidação aconteceu —
    // é o único lugar autorizado a nomear o domínio morto, e só em prosa.
    const comDominioMorto = TODOS.filter((a) => a !== ARQUIVO_CANONICO && /ciclo\.app/.test(readFileSync(a, 'utf8')))
    expect(
      comDominioMorto,
      '`ciclo.app` nunca foi registrado. Use `APP_URL`/`APP_HOST` de `@/lib/app-url`.',
    ).toEqual([])
  })

  it('nenhum arquivo fora de lib/app-url.ts tem literal de domínio do produto nem fallback inline', () => {
    const infratores: string[] = []
    for (const arquivo of TODOS) {
      if (arquivo === ARQUIVO_CANONICO) continue
      const src = readFileSync(arquivo, 'utf8')
      if (/\bseuciclo\b/.test(src)) infratores.push(`${arquivo} (literal 'seuciclo')`)
      // `NEXT_PUBLIC_APP_URL` sozinho pode aparecer (`exigirEnv('NEXT_PUBLIC_APP_URL')`); o que
      // não pode voltar é o fallback com string de URL, que foi o padrão consolidado.
      if (/NEXT_PUBLIC_APP_URL\s*\?\?\s*['"`]https?:/.test(src)) infratores.push(`${arquivo} (fallback inline)`)
    }
    expect(
      infratores,
      'literal de domínio ou fallback de URL fora de `src/lib/app-url.ts` — consolide lá.',
    ).toEqual([])
  })

  it('APP_HOST é APP_URL sem protocolo e sem barra final', () => {
    expect(APP_URL).toMatch(/^https:\/\//)
    expect(APP_HOST).toBe(APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, ''))
    expect(APP_HOST).not.toMatch(/\/$/)
  })

  it('as duas telas que mostravam o link morto agora usam APP_HOST', () => {
    // Casa com a CHAMADA (`APP_HOST` usado no arquivo), não com o import solto.
    for (const tela of ['src/app/onboarding/formulario.tsx', 'src/app/admin/config/negocio/formulario.tsx']) {
      expect(/APP_HOST/.test(readFileSync(tela, 'utf8')), `${tela} não usa APP_HOST`).toBe(true)
    }
  })
})
