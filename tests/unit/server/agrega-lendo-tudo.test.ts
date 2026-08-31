import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O PostgREST corta em `max_rows = 1000` (supabase/config.toml) e NAO erra ao cortar: devolve as
 * primeiras mil linhas e cala. Quem SOMA ou CONTA em cima disso entrega numero errado com cara de
 * certo.
 *
 * O `CLAUDE.md` chama de "a armadilha do TICKET-036", e `v_carteira_resumo` (0018) nasceu por
 * causa dela. Em 31/08 quase reintroduzi: as metricas da ficha da cliente passaram a contar
 * linhas de verdade em vez de ler coluna desnormalizada, e a consulta saiu sem paginacao — troquei
 * "completo porem defasado" por "fresco porem truncavel".
 */
const RAIZ = join('src', 'server')

function ts(dir: string): string[] {
  const achados: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, e.name)
    if (e.isDirectory()) achados.push(...ts(caminho))
    else if (e.name.endsWith('.ts') && !e.name.endsWith('types.gen.ts')) achados.push(caminho)
  }
  return achados
}

describe('quem agrega no Node le todas as linhas', () => {
  it('o teto do PostgREST continua sendo 1000 — se mudar, os numeros abaixo mudam junto', () => {
    const cfg = readFileSync(join('supabase', 'config.toml'), 'utf8')
    expect(cfg, 'sumiu o max_rows da config — o teto passou a ser desconhecido').toMatch(/max_rows\s*=\s*1000/)
  })

  it('as metricas da ficha leem paginado', () => {
    const crm = semComentarios(readFileSync(join('src', 'server', 'services', 'crm.ts'), 'utf8'))
    expect(crm, 'a consulta que alimenta visitas/valor/faltas voltou a nao paginar').toContain('buscarTudoPaginado(')
  })

  it('o helper de paginacao mora num lugar so', () => {
    // Antes de 31/08 ele vivia dentro de `segmentos.ts`. Copiar para o segundo leitor seria repetir
    // a duplicacao que este projeto vem desfazendo — a copia que envelhece e a que ninguem lembra.
    const donos = ts(RAIZ).filter((f) => semComentarios(readFileSync(f, 'utf8')).includes('async function buscarTudoPaginado'))
    expect(donos.map((d) => d.split(String.fromCharCode(92)).join('/')), 'apareceu uma segunda copia do paginador').toEqual([
      'src/server/db/paginar.ts',
    ])
  })
})
