import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PACOTES } from '@/core/pacotes'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/101 T0.1. O pacote existe em dois lugares por motivos diferentes: no `check` de
 * `professions.pacote` (migration 0101), para o banco recusar valor inventado; e em
 * `core/pacotes/`, para a interface ter abas e palavras sem ida ao banco. Duplicação vigiada é
 * segura; duplicação silenciosa é a armadilha da §L.6 de novo (`modulos-catalogo.test.ts`).
 *
 * O defeito que esta guarda pega: valor no `check` sem entrada no registro. `normalizarPacote`
 * cairia em `base` e um tenant inteiro perderia a barra do pacote sem erro nenhum.
 */
const SQL = readFileSync('supabase/migrations/0101_pacote_advocacia.sql', 'utf8')

function slugsDoCheck(): string[] {
  const m = /check \(pacote in \(([^)]+)\)\)/.exec(SQL)
  if (!m) throw new Error('não achei o `check (pacote in (...))` na 0101: a guarda cegou')
  return [...m[1]!.matchAll(/'([a-z_]+)'/g)].map((x) => x[1] as string).sort()
}

describe('professions.pacote e core/pacotes não podem divergir', () => {
  it('os mesmos slugs, nos dois lados', () => {
    const noBanco = slugsDoCheck()
    expect(noBanco.length, 'o check ficou vazio').toBeGreaterThanOrEqual(2)
    expect(Object.keys(PACOTES).sort()).toEqual(noBanco)
  })

  it('o padrão da coluna é base: nenhuma profissão existente muda de pacote', () => {
    expect(/default 'base'/.test(SQL)).toBe(true)
  })

  it('a linha advocacia grava o pacote advocacia, não o padrão', () => {
    // Casa com a LINHA do insert (a coluna `pacote` é a última), não com o nome da profissão solto.
    const linha = /\('advocacia', 'Advocacia'[\s\S]*?, 'advocacia'\)\s*on conflict/.exec(SQL)
    expect(linha, 'a linha advocacia não grava pacote = advocacia').not.toBeNull()
  })

  it('cada pacote do registro declara o próprio slug', () => {
    for (const [chave, pacote] of Object.entries(PACOTES)) expect(pacote.slug).toBe(chave)
  })
})

describe('o contexto do tenant entrega o pacote resolvido', () => {
  /*
   * A costura entre as pontas, que é onde este projeto já perdeu recurso inteiro sem ninguém ver
   * (`vocab_override` ficou um mês sem leitor). Sem banco local nesta rodada não há teste de
   * integração para `DadosDoTenant.pacote`; a guarda de código casa com a COLUNA no `select` e com
   * a CHAMADA de `normalizarPacote(`, nunca com o nome solto, que o `import` já traria.
   */
  const fonte = semComentarios(readFileSync('src/server/auth/tenant.ts', 'utf8'))

  it('o select traz professions(vocab, pacote)', () => {
    expect(/professions\(vocab, pacote\)/.test(fonte), 'o contexto parou de buscar o pacote no join').toBe(true)
  })

  it('o valor cru passa por normalizarPacote antes de virar DadosDoTenant', () => {
    expect(/pacote: normalizarPacote\(bruto\.professions\?\.pacote\)/.test(fonte), 'o pacote chega cru ou não chega').toBe(true)
  })
})
