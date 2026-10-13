import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-024 (achado C-39): `/admin/config/profissionais/[id]` (expediente e folgas de cada
 * profissional) existia e só abria digitando a URL — nenhum link montava a rota. Tela que ninguém
 * alcança é funcionalidade que não existe para quem usa.
 *
 * Toda `page.tsx` precisa de uma referência REAL no código: um texto que monte a rota (`href`,
 * `router.push`, `redirect`, link de e-mail). Segmento dinâmico casa com `${...}`. As entradas que
 * vêm de FORA do código (a pessoa digita, o buscador acha, o app nativo abre) ficam listadas com o
 * motivo.
 */
const ENTRADAS_EXTERNAS: Record<string, string> = {
  '/': 'a home: é o endereço que a pessoa digita',
  '/[slug]': 'a página de cada negócio: o dono divulga o link dele, o buscador acha',
  '/dev/ui': 'vitrine de componentes para quem desenvolve; em produção dá notFound()',
}

function arquivos(dir: string, filtro: (nome: string) => boolean): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho, filtro)
    return filtro(nome) ? [caminho] : []
  })
}

/** `src/app/(public)/convite/[token]/page.tsx` → `/convite/[token]`; grupos entre parênteses somem. */
function rotaDe(pagina: string): string {
  const partes = relative('src/app', pagina).split(sep).slice(0, -1).filter((p) => !/^\(.*\)$/.test(p))
  return '/' + partes.join('/')
}

/** O texto que montaria a rota: segmento dinâmico vira `${...}`; termina em aspas, crase, `?`, `#` ou `/`. */
function padraoDe(rota: string): RegExp {
  const corpo = rota
    .split('/')
    .map((seg) => (/^\[.*\]$/.test(seg) ? '\\$\\{[^}]+\\}' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/')
  return new RegExp(`(?:['"\`]|\\})${corpo}(?:['"\`?#]|\\/\\$\\{|$)`)
}

const PAGINAS = arquivos('src/app', (n) => n === 'page.tsx')
const FONTES = arquivos('src', (n) => /\.(tsx?|mjs)$/.test(n)).map((f) => ({ arquivo: f, texto: semComentarios(readFileSync(f, 'utf8')) }))

function referenciada(rota: string, propria: string): boolean {
  const padrao = padraoDe(rota)
  return FONTES.some((f) => f.arquivo !== propria && padrao.test(f.texto))
}

describe('toda página tem quem aponte para ela (APR-024)', () => {
  it('controle positivo: o detector casa a rota montada e não casa prefixo de outra', () => {
    expect(padraoDe('/admin/config/profissionais/[id]').test('href={`/admin/config/profissionais/${p.id}`}')).toBe(true)
    expect(padraoDe('/admin/caixa').test(`router.push('/admin/caixa')`)).toBe(true)
    expect(padraoDe('/admin/caixa').test(`href="/admin/caixa-antigo"`)).toBe(false)
    expect(padraoDe('/convite/[token]').test('`${appUrl}/convite/${token}`')).toBe(true)
  })

  it('a varredura acha páginas (não passa vazia)', () => {
    expect(PAGINAS.length).toBeGreaterThan(40)
  })

  it('toda página tem referência no código ou está nas entradas externas com motivo', () => {
    const orfas = PAGINAS.map((p) => ({ pagina: p, rota: rotaDe(p) }))
      .filter(({ rota }) => !(rota in ENTRADAS_EXTERNAS))
      .filter(({ pagina, rota }) => !referenciada(rota, pagina))
      .map(({ rota }) => rota)
    expect(orfas).toEqual([])
  })

  it('expediente e folgas de cada profissional têm link na Equipe', () => {
    expect(referenciada('/admin/config/profissionais/[id]', 'src/app/admin/config/profissionais/[id]/page.tsx')).toBe(true)
  })
})
