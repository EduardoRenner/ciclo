import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CATALOGO, PLANOS, type ModuloKey } from '@/core/billing/planos'

/**
 * O catálogo de módulos existe em dois lugares por motivos diferentes: em `core` para a interface
 * ter rótulo sem ida ao banco, e nas migrations 0041/0043 para `tenant_modules.modulo` ter alvo de
 * chave estrangeira. Duplicação vigiada é segura; duplicação silenciosa é a armadilha da §L.6 outra vez.
 *
 * Este teste é a vigia. Se alguém acrescentar um módulo em um dos lados e esquecer o outro, quebra
 * aqui — e não em produção, com um módulo que a tela mostra e o banco recusa (ou o contrário).
 */

const SQL = readFileSync('supabase/migrations/0041_modules_catalogo.sql', 'utf8')
// docs/26-AGENTE-IA-PLANO.md §6 (A6): 0041 já foi aplicada em produção e não pode ser editada —
// o 17º módulo (`assistant`) entrou como INSERT novo nesta migration.
const SQL_ASSISTENTE = readFileSync('supabase/migrations/0043_modulo_assistente.sql', 'utf8')

/** Lê as chaves de um `insert into modules (...) values ('agenda', ...), ('cycle_engine', ...)`. */
function chavesDoInsert(sql: string, origem: string): string[] {
  const bloco = /insert into modules[\s\S]*?;/.exec(sql)
  if (!bloco) throw new Error(`não achei o insert de \`modules\` em ${origem}`)
  return [...bloco[0].matchAll(/^\s*\('([a-z_]+)'/gm)].map((m) => m[1] as string)
}

function chavesDaMigration(): string[] {
  return [...chavesDoInsert(SQL, '0041'), ...chavesDoInsert(SQL_ASSISTENTE, '0043')]
}

describe('catálogo de módulos: core e migrations 0041/0043 não podem divergir', () => {
  it('as mesmas 17 chaves, na mesma ordem', () => {
    const naMigration = chavesDaMigration()
    const noCore = CATALOGO.map((m) => m.key)

    expect(naMigration).toHaveLength(17)
    expect(noCore).toEqual(naMigration)
  })

  it('todo módulo que algum plano libera existe no catálogo', () => {
    const doCatalogo = new Set<ModuloKey>(CATALOGO.map((m) => m.key))
    for (const tier of ['gratis', 'essencial', 'equipe', 'avancado'] as const) {
      for (const modulo of PLANOS[tier].modulos) {
        expect(doCatalogo.has(modulo), `${modulo} está no plano ${tier} e fora do catálogo`).toBe(true)
      }
    }
  })

  it('todo módulo do catálogo é liberado por algum plano — nenhum fica órfão', () => {
    // Módulo que nenhum degrau libera é ou erro de empacotamento, ou funcionalidade que ninguém
    // consegue alcançar. Nas duas hipóteses é defeito, não decisão.
    const liberados = new Set<ModuloKey>(PLANOS.avancado.modulos)
    for (const m of CATALOGO) {
      expect(liberados.has(m.key), `${m.key} não é liberado nem no plano mais alto`).toBe(true)
    }
  })

  it('os módulos "sempre ligados" do core são os mesmos da migration', () => {
    const sempreNaMigration = [...SQL.matchAll(/^\s*\('([a-z_]+)',[^)]*?,\s*(true|false),\s*\d+\)/gm)]
      .filter((m) => m[2] === 'true')
      .map((m) => m[1])
    const sempreNoCore = CATALOGO.filter((m) => m.sempreLigado).map((m) => m.key)

    expect(sempreNoCore).toEqual(sempreNaMigration)
    // Agenda e Motor de Ciclo: um é o produto, o outro é o diferencial. Nenhum dos dois desliga.
    expect(sempreNoCore).toEqual(['agenda', 'cycle_engine'])
  })
})
