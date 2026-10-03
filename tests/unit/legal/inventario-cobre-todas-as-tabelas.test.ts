import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * O inventário de tratamento (LGPD art. 37, `docs/legal/inventario-de-tratamento.md`) é um documento
 * escrito à mão sobre um schema que cresce. Sem guarda ele apodrece calado: a tabela nova com dado
 * pessoal nasce sem classificação, e a política continua dizendo que se sabe o que se guarda.
 *
 * Duas direções, as duas necessárias: toda tabela do schema tem linha, e toda linha aponta para
 * tabela que existe (senão o inventário descreve um schema que já foi embora).
 *
 * Lê `types.gen.ts` e não o banco, para reprovar no commit que cria a tabela e rodar no CI sem
 * Postgres. As tabelas saem do bloco `Tables` do schema `public`.
 */
const TIPOS = readFileSync('src/server/db/types.gen.ts', 'utf8').replace(/\r\n/g, '\n')
const INVENTARIO = readFileSync('docs/legal/inventario-de-tratamento.md', 'utf8').replace(/\r\n/g, '\n')

function tabelasDoSchema(): string[] {
  const publico = TIPOS.slice(TIPOS.indexOf('  public: {'))
  const tabelas = publico.slice(publico.indexOf('    Tables: {'), publico.indexOf('    Views: {'))
  return [...tabelas.matchAll(/\n {6}([a-z_0-9]+): \{\n {8}Row: \{/g)].map((m) => m[1]!)
}

function tabelasDoInventario(): string[] {
  return [...INVENTARIO.matchAll(/^\| `([a-z_0-9]+)` \|/gm)].map((m) => m[1]!)
}

describe('o inventário de tratamento cobre o schema', () => {
  const noSchema = tabelasDoSchema()
  const noInventario = tabelasDoInventario()

  it('o detector enxerga o cenário: acha dezenas de tabelas nos dois lados, senão as asserções abaixo passariam vazias', () => {
    expect(noSchema.length, 'não achei as tabelas em types.gen.ts: o formato mudou').toBeGreaterThan(50)
    expect(noInventario.length, 'não achei linhas de tabela no inventário: o formato mudou').toBeGreaterThan(50)
  })

  it('toda tabela do schema tem linha no inventário', () => {
    const faltam = noSchema.filter((t) => !noInventario.includes(t))
    expect(faltam, `tabela(s) sem classificação em docs/legal/inventario-de-tratamento.md: ${faltam.join(', ')}`).toEqual([])
  })

  it('toda linha do inventário aponta para uma tabela que existe', () => {
    const sobram = noInventario.filter((t) => !noSchema.includes(t))
    expect(sobram, `linha(s) do inventário sem tabela no schema: ${sobram.join(', ')}`).toEqual([])
  })

  it('nenhuma tabela aparece duas vezes (duas classificações para a mesma coisa)', () => {
    const repetidas = noInventario.filter((t, i) => noInventario.indexOf(t) !== i)
    expect(repetidas).toEqual([])
  })

  it('toda linha diz a base legal e a retenção (célula vazia é inventário de mentira)', () => {
    const linhas = INVENTARIO.split('\n').filter((l) => /^\| `[a-z_0-9]+` \|/.test(l))
    for (const l of linhas) {
      const celulas = l.split('|').slice(1, -1).map((c) => c.trim())
      expect(celulas.length, `linha com colunas a menos: ${l.slice(0, 60)}`).toBe(7)
      for (const [i, c] of celulas.entries()) expect(c.length, `célula ${i} vazia em ${celulas[0]}`).toBeGreaterThan(0)
    }
  })
})
