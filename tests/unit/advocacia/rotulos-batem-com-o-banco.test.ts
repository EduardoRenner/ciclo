import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AREAS_DO_CASO, ESTADOS_DO_CASO } from '@/core/advocacia/casos'
import { TIPOS_DE_CASO } from '@/core/advocacia/checklist'
import { seloDoEstado } from '@/core/advocacia/resumo-do-caso'

/**
 * As listas do núcleo (o que a tela oferece e o Zod aceita) e o `check` da 0105 (o que o banco
 * aceita) são duas cópias. Esta guarda lê o `check` do arquivo da migration e exige as MESMAS
 * listas: opção na tela que o banco recusa vira erro 500 no "Abrir caso".
 */
const SQL = readFileSync('supabase/migrations/0105_legal_casos.sql', 'utf8')

function valoresDoCheck(coluna: string): string[] {
  // `kind` e `status` existem em outras tabelas do arquivo: casa só a declaração `coluna text ... check (coluna in (...))`
  const m = SQL.match(new RegExp(String.raw`\n\s*${coluna}\s+text[^\n]*check \(${coluna} in \(([^)]*)\)`, 's'))
  if (!m) throw new Error(`não achei o check de ${coluna} na 0105: a guarda perdeu o alvo`)
  return [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1]!)
}

describe('listas do caso batem com o check do banco', () => {
  it.each([
    ['kind', TIPOS_DE_CASO],
    ['area', AREAS_DO_CASO],
    ['status', ESTADOS_DO_CASO],
  ] as const)('%s', (coluna, lista) => {
    const doBanco = valoresDoCheck(coluna)
    expect(doBanco.length, 'o check foi lido').toBeGreaterThan(3)
    expect([...lista].sort()).toEqual([...doBanco].sort())
  })
})

describe('seloDoEstado', () => {
  it('nenhum estado usa o tom do cadeado', () => {
    for (const e of ESTADOS_DO_CASO) expect(seloDoEstado(e)).not.toBe('info')
  })
})
