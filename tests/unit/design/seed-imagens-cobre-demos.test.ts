import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { SLUGS_DE_DEMONSTRACAO_PARA_TESTE } from '@/core/tenants/demonstracao'

/**
 * `scripts/seed-demo-imagens.mjs` sobe logo/capa/avatar das contas de demonstração. Ele roda fora
 * do app (Node puro, sem loader de TS), então não dá para importar a lista de `demonstracao.ts` —
 * ela está copiada no script. Cópia sem guarda é cópia que envelhece: quando alguém acrescenta um
 * tenant de demonstração em `demonstracao.ts` e esquece o script, aquela conta fica sem imagem
 * nenhuma na página que a cliente abre, e nada reclama.
 *
 * Esta guarda casa com o ARRAY do script (o valor que precisa acompanhar a fonte), não com o
 * comentário que o descreve.
 */
const SCRIPT = join('scripts', 'seed-demo-imagens.mjs')

function slugsNoScript(): string[] {
  const src = readFileSync(SCRIPT, 'utf8')
  const bloco = src.match(/const SLUGS_DE_DEMONSTRACAO = \[([\s\S]*?)\]/)
  if (!bloco) throw new Error('não achei `const SLUGS_DE_DEMONSTRACAO = [...]` em seed-demo-imagens.mjs — a guarda perdeu o alvo')
  return [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

describe('seed-demo-imagens cobre toda a lista de demonstração', () => {
  it('o array do script é exatamente SLUGS_DE_DEMONSTRACAO', () => {
    expect([...slugsNoScript()].sort()).toEqual([...SLUGS_DE_DEMONSTRACAO_PARA_TESTE].sort())
  })
})
