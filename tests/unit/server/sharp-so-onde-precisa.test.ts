import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * `docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §7. O `sharp` carrega `@img/*` — o libvips nativo,
 * **19,2 MB**. Enquanto `fazerUploadMedia` morava em `media.ts` junto das consultas, qualquer
 * import daquele arquivo arrastava o binário: `admin/hoje/page.tsx` → `crm.ts` → `media.ts` →
 * `sharp`. `/admin/hoje`, a tela inicial do painel, era empacotada com 23,4 MB contra uma
 * mediana de 1,8 MB por rota, e media 1.870 ms de cold start.
 *
 * Este teste não procura a string `sharp` num arquivo — isso passaria com o defeito de volta,
 * porque o problema nunca esteve no arquivo que importa e sim no **caminho** até ele. Ele anda
 * o grafo de imports a partir de cada entrada e responde a pergunta que importa: *dá para chegar
 * no `sharp` a partir daqui?*
 */

const RAIZ = resolve(__dirname, '../../..')
const SRC = join(RAIZ, 'src')

/** Resolve `@/x`, `./x` e `../x` para um arquivo real; devolve `null` para pacote de node_modules. */
function resolverImport(especificador: string, deArquivo: string): string | null {
  let base: string
  if (especificador.startsWith('@/')) base = join(SRC, especificador.slice(2))
  else if (especificador.startsWith('.')) base = resolve(dirname(deArquivo), especificador)
  else return null

  for (const sufixo of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const tentativa = base + sufixo
    if (existsSync(tentativa) && !tentativa.endsWith('/')) {
      try {
        if (readFileSync(tentativa)) return tentativa
      } catch {
        /* diretório — segue tentando */
      }
    }
  }
  return null
}

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * Todo módulo alcançável a partir de `entrada`, mais os pacotes externos vistos no caminho.
 * `import()` dinâmico entra junto de propósito: o tracing do Next também o segue, então ele
 * arrasta o binário para o pacote da rota do mesmo jeito que o `import` estático.
 */
function alcancaveis(entrada: string): { pacotes: Set<string>; caminho: Map<string, string> } {
  const vistos = new Set<string>()
  const pacotes = new Set<string>()
  const caminho = new Map<string, string>()
  const fila = [entrada]

  while (fila.length > 0) {
    const arquivo = fila.pop()!
    if (vistos.has(arquivo)) continue
    vistos.add(arquivo)

    const codigo = readFileSync(arquivo, 'utf8')
    for (const m of codigo.matchAll(IMPORT)) {
      const espec = m[1] ?? m[2]
      if (!espec) continue
      const alvo = resolverImport(espec, arquivo)
      if (alvo === null) {
        pacotes.add(espec)
        if (!caminho.has(espec)) caminho.set(espec, arquivo.replace(RAIZ, '').split(String.fromCharCode(92)).join('/'))
        continue
      }
      if (!vistos.has(alvo)) fila.push(alvo)
    }
  }

  return { pacotes, caminho }
}

/** Telas e rotas que nunca processam imagem — nenhuma delas pode ter caminho até o `sharp`. */
const SEM_SHARP = [
  'src/app/admin/hoje/page.tsx',
  'src/app/admin/clientes/page.tsx',
  'src/app/admin/clientes/[id]/page.tsx',
  'src/app/admin/campanhas/nova/page.tsx',
  'src/app/admin/agenda/page.tsx',
  'src/app/api/v1/campaigns/route.ts',
  'src/app/api/v1/media/[id]/url/route.ts',
  /*
   * As duas páginas públicas entraram junto com a logo e a capa (31/08). São as que MAIS importam
   * nesta lista: é o link que a cliente abre no 4G, e o único que quem não é cliente do CICLO vê.
   * Elas leem a chave da imagem de `settings.site` e montam o endereço com `core/text/vitrine.ts`,
   * que é puro de propósito — se alguém trocar isso por um import de `vitrine-upload.ts` para
   * reaproveitar uma constante, o libvips vai junto para o pacote da rota e ninguém percebe até a
   * página ficar lenta.
   */
  'src/app/(public)/[slug]/page.tsx',
  'src/app/(public)/[slug]/agendar/page.tsx',
]

describe('sharp só onde precisa (§7 — 19,2 MB de libvips)', () => {
  it.each(SEM_SHARP)('%s não alcança o sharp por nenhum caminho de import', (rel) => {
    const { pacotes, caminho } = alcancaveis(join(RAIZ, rel))
    expect(pacotes.has('sharp'), `chegou no sharp via ${caminho.get('sharp')}`).toBe(false)
  })

  it.each([
    'src/app/api/v1/clients/[id]/media/route.ts',
    'src/app/api/v1/tenant/vitrine/route.ts',
    'src/app/api/v1/tenant/vitrine/entidade/route.ts',
  ])('%s CONTINUA alcançando o sharp', (rel) => {
    // O outro lado da regra. Sem isto, "ninguém importa sharp" passaria — inclusive com o
    // upload quebrado em produção por módulo não encontrado, que foi o efeito colateral real
    // da tentativa com `outputFileTracingExcludes`.
    const { pacotes } = alcancaveis(join(RAIZ, rel))
    expect(pacotes.has('sharp')).toBe(true)
  })

  it('crm.ts importa as consultas de media, nunca o arquivo de upload', () => {
    // É o elo exato que criava o problema: `crm.ts` precisa de `listarMediaDoCliente`, que é só
    // um select, e ficava no mesmo arquivo do upload.
    const crm = readFileSync(join(SRC, 'server/services/crm.ts'), 'utf8')
    expect(crm).toContain("from '@/server/services/media'")
    expect(crm).not.toContain('media-upload')
  })
})
