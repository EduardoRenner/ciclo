import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Toda `db.rpc('nome')` chamada em `src/` precisa de uma função com esse nome nas migrations.
 *
 * Nasceu junto da correção do achado S11 (débito de carteira atômico), que moveu a decisão para
 * uma função nova no banco. O risco que ele fecha é de deploy, não de código: `pnpm build` e
 * `pnpm typecheck` passam com folga mesmo que a migration nunca seja aplicada — o nome da RPC é
 * conferido contra `types.gen.ts`, que é um arquivo, não contra o Postgres. Subir o código sem a
 * migration faria **todo débito de carteira responder 500**, e nada no caminho avisaria antes.
 *
 * O teste também vale ao contrário do esperado: quem escrever `rpc('x')` errando o nome vê o erro
 * aqui, em vez de em produção.
 */

const MIGRATIONS = 'supabase/migrations'
const FONTES = 'src'

function arquivos(dir: string, extensoes: string[]): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name)
    if (entrada.isDirectory()) achados.push(...arquivos(caminho, extensoes))
    else if (extensoes.some((e) => entrada.name.endsWith(e))) achados.push(caminho)
  }
  return achados
}

/** Nomes chamados por `.rpc('...')` — só literal; nome montado em runtime não existe neste projeto. */
function rpcsChamadas(): Map<string, string[]> {
  const porNome = new Map<string, string[]>()
  for (const arquivo of arquivos(FONTES, ['.ts', '.tsx'])) {
    if (arquivo.endsWith('types.gen.ts')) continue
    const conteudo = readFileSync(arquivo, 'utf8')
    for (const m of conteudo.matchAll(/\.rpc\(\s*['"`](\w+)['"`]/g)) {
      const nome = m[1]!
      porNome.set(nome, [...(porNome.get(nome) ?? []), arquivo])
    }
  }
  return porNome
}

function funcoesDeclaradas(): Set<string> {
  const nomes = new Set<string>()
  for (const arquivo of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, arquivo), 'utf8')
    for (const m of sql.matchAll(/create\s+(?:or replace\s+)?function\s+(?:public\.)?(\w+)/gi)) {
      nomes.add(m[1]!.toLowerCase())
    }
  }
  return nomes
}

const CHAMADAS = rpcsChamadas()
const DECLARADAS = funcoesDeclaradas()

describe('toda RPC chamada existe nas migrations', () => {
  it('o leitor enxerga as duas pontas', () => {
    // Sanidade: se um dos dois lados vier vazio, o teste principal passa sem conferir nada —
    // verde por não ter olhado, que é o pior estado possível para uma guarda.
    expect(CHAMADAS.size).toBeGreaterThanOrEqual(4)
    expect(DECLARADAS.has('claim_jobs')).toBe(true)
    expect(DECLARADAS.has('debitar_carteira')).toBe(true)
  })

  it('nenhuma chamada aponta para função que não existe', () => {
    const orfas = [...CHAMADAS.entries()]
      .filter(([nome]) => !DECLARADAS.has(nome.toLowerCase()))
      .map(([nome, arquivos_]) => `${nome} (chamada em ${arquivos_.join(', ')})`)

    expect(
      orfas,
      'RPC sem função correspondente em supabase/migrations. O typecheck não pega isto: ' +
        'o nome é conferido contra types.gen.ts, que é arquivo, não banco. Deployar assim ' +
        'quebra a rota em produção, não no build.',
    ).toEqual([])
  })
})
