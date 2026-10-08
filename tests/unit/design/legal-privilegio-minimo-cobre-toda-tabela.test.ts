import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/101 T1.10: a 0115 revoga DELETE/TRUNCATE e tira `anon` de cada tabela jurídica PELO NOME. Tabela
 * `legal_*` nova nasceria com o padrão do Supabase (todos os privilégios) sem ninguém notar. Esta guarda
 * lê os `create table public.legal_*` de todas as migrations e exige cada um na lista da 0115 (ou numa
 * migration posterior que faça o mesmo, quando existir: aí esta guarda muda junto).
 */
const PASTA = join('supabase', 'migrations')
const fontes = readdirSync(PASTA)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => ({ f, sql: semComentarios(readFileSync(join(PASTA, f), 'utf8')) }))

const criadas = [...new Set(fontes.flatMap(({ sql }) => [...sql.matchAll(/create table public\.(legal_[a-z_]+)/g)].map((m) => m[1]!)))].sort()
const revogacao = fontes.find(({ f }) => f.startsWith('0115_'))!
const lista = revogacao.sql.match(/tabelas text\[\] := array\[([^\]]*)\]/s)?.[1] ?? ''
const naLista = [...lista.matchAll(/'(legal_[a-z_]+)'/g)].map((m) => m[1]!).sort()

describe('privilégio mínimo cobre toda tabela jurídica', () => {
  it('a varredura achou as tabelas e a lista (piso pelo positivo conhecido)', () => {
    expect(criadas).toContain('legal_cases')
    expect(criadas).toContain('legal_access_log')
    expect(criadas.length).toBeGreaterThanOrEqual(21)
    expect(naLista.length, 'a lista da 0115 não foi lida').toBeGreaterThanOrEqual(21)
  })

  it('toda tabela legal_* criada está na revogação da 0115', () => {
    expect(criadas.filter((t) => !naLista.includes(t))).toEqual([])
  })
})
