import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * APR-031 (achado G-05): `/confirmar`, `/avaliar`, `/orcamento`, `/lista-espera` e `/convite` com
 * token mostram negócio, serviço e horário de UMA pessoa, e não tinham `noindex`. A correção R-09
 * vale tanto quanto a regra: essas rotas NÃO podem ir para o `Disallow` do `robots.ts` — bloqueada,
 * a página não é lida, o robô não vê o `noindex`, e a URL aparece se outro site linkar.
 */
function pastasComToken(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (!statSync(caminho).isDirectory()) return []
    return nome === '[token]' ? [caminho, ...pastasComToken(caminho)] : pastasComToken(caminho)
  })
}

/** `src/app/(public)/confirmar/[token]` → `confirmar` (o segmento antes do token). */
function segmentoDe(pasta: string): string {
  const partes = relative('src/app', pasta).split(sep).filter((p) => !/^\(.*\)$/.test(p))
  return partes[partes.length - 2]!
}

const PASTAS = pastasComToken('src/app').filter((p) => !p.split(sep).includes('api'))
const CONFIG = semComentarios(readFileSync('next.config.ts', 'utf8'))
const ROBOTS = semComentarios(readFileSync('src/app/robots.ts', 'utf8'))
const NOINDEX = /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/

describe('página com token fora do buscador (APR-031)', () => {
  it('controle positivo: acha as cinco páginas com token conhecidas (não passa vazia)', () => {
    const segmentos = PASTAS.map(segmentoDe)
    for (const s of ['confirmar', 'avaliar', 'orcamento', 'lista-espera', 'convite']) expect(segmentos, s).toContain(s)
  })

  it('toda página com token tem noindex, nofollow no metadata', () => {
    const sem = PASTAS.filter((p) => !NOINDEX.test(readFileSync(join(p, 'page.tsx'), 'utf8'))).map(segmentoDe)
    expect(sem).toEqual([])
  })

  it('toda página com token recebe o cabeçalho X-Robots-Tag', () => {
    const lista = CONFIG.match(/ROTAS_COM_TOKEN\s*=\s*\[([^\]]*)\]/)?.[1] ?? ''
    expect(CONFIG).toMatch(/X-Robots-Tag/)
    const sem = PASTAS.map(segmentoDe).filter((s) => !lista.includes(`"${s}"`))
    expect(sem).toEqual([])
  })

  it('nenhuma página com token no robots.ts (o Disallow esconderia o noindex)', () => {
    const bloqueadas = PASTAS.map(segmentoDe).filter((s) => ROBOTS.includes(`'/${s}`) || ROBOTS.includes(`"/${s}`))
    expect(bloqueadas).toEqual([])
  })
})
