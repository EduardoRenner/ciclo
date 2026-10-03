import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * docs/87 E5 — "nunca converto cortesia em cobrança sem um toque de assinar. Nem com o cartão à
 * mão, nem com aviso." É o que sustenta a promessa de `/precos` e o CDC.
 *
 * A cortesia não pede cartão (não há onde guardá-lo), mas a garantia não pode ficar só nisso: no dia
 * em que alguém escrever "ao fim da cortesia, já cria a assinatura para não perder o cliente", o
 * defeito é uma linha e nenhum teste de comportamento o vê, porque o Mercado Pago do teste é de
 * mentira. Esta guarda olha o que MUDA quando o defeito volta: o grafo de imports e a CHAMADA.
 *
 * ## O que ela afirma
 *
 *  1. Nenhum arquivo que fala de cortesia (todo importador de `core/billing/prelancamento`, mais
 *     `contextoDePlano` e o cadastro) alcança, por import de execução, o cliente do Mercado Pago
 *     nem o serviço de assinatura — nem direto, nem por vizinho de vizinho.
 *  2. Nenhum deles CHAMA uma função de cobrança. Casa com `nome(`, e não com o nome solto, que
 *     aparece em `import`, em comentário e em texto de ajuda (a armadilha nº 1 da tabela do
 *     CLAUDE.md).
 *  3. Criar cobrança (`iniciarAssinatura(`, `criarPreapproval(`) tem UM chamador cada, e é o toque:
 *     a rota `POST /api/v1/billing/assinar`, a única que nasce de um clique do dono.
 *
 * Só conta import de execução: `import type` some na compilação e não põe nada no caminho.
 */

const RAIZ = 'src'
const CLIENTE_MP = 'src/server/billing/mercado-pago.ts'
const SERVICO_ASSINATURA = 'src/server/services/assinatura-mp.ts'
const ROTA_DO_TOQUE = 'src/app/api/v1/billing/assinar/route.ts'
const PRELANCAMENTO = 'src/core/billing/prelancamento.ts'

/** As três funções que criam, consultam ou desfazem cobrança no provedor. */
const CHAMADA_DE_COBRANCA =
  /\b(criarPreapproval|iniciarAssinatura|cancelarAssinatura|cancelarPreapproval|consultarPreapproval|consultarPagamento|processarWebhookMP)\s*\(/

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.tsx?$/.test(nome) ? [caminho.replace(/\\/g, '/')] : []
  })
}

const TODOS = arquivos(RAIZ)
const CODIGO = new Map(TODOS.map((f) => [f, semComentarios(readFileSync(f, 'utf8'))]))

function resolver(de: string, alvo: string): string | null {
  let base: string
  if (alvo.startsWith('@/')) base = join(RAIZ, alvo.slice(2))
  else if (alvo.startsWith('.')) base = join(dirname(de), alvo)
  else return null
  for (const candidato of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    const norm = candidato.replace(/\\/g, '/')
    if (existsSync(norm) && statSync(norm).isFile()) return norm
  }
  return null
}

/** Os imports que EXECUTAM. `import type ...` fica de fora: não existe depois de compilar. */
function importsDeExecucao(codigo: string): string[] {
  const alvos: string[] = []
  for (const m of codigo.matchAll(/(?:^|\n)[ \t]*(?:import|export)[ \t]+(type[ \t]+)?[^;'"]*?\bfrom[ \t]*['"]([^'"]+)['"]/g)) {
    if (!m[1] && m[2]) alvos.push(m[2])
  }
  for (const m of codigo.matchAll(/(?:^|\n)[ \t]*import[ \t]*['"]([^'"]+)['"]/g)) if (m[1]) alvos.push(m[1])
  for (const m of codigo.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) if (m[1]) alvos.push(m[1])
  return alvos
}

/** Tudo que o arquivo alcança por import de execução, ele mesmo incluído. */
function alcance(inicio: string): Set<string> {
  const visto = new Set<string>()
  const fila = [inicio]
  while (fila.length > 0) {
    const atual = fila.pop() as string
    if (visto.has(atual)) continue
    visto.add(atual)
    const codigo = CODIGO.get(atual)
    if (codigo === undefined) continue
    for (const alvo of importsDeExecucao(codigo)) {
      const resolvido = resolver(atual, alvo)
      if (resolvido && !visto.has(resolvido)) fila.push(resolvido)
    }
  }
  return visto
}

/** Os arquivos que falam de cortesia: quem importa o núcleo dela, mais o leitor do plano e o cadastro. */
function caminhosDaCortesia(): string[] {
  const importadores = TODOS.filter((f) => {
    if (f === PRELANCAMENTO) return false
    return importsDeExecucao(CODIGO.get(f) ?? '').some((alvo) => resolver(f, alvo) === PRELANCAMENTO)
  })
  return [...new Set([PRELANCAMENTO, 'src/server/services/planos.ts', 'src/server/services/onboarding.ts', ...importadores])]
}

describe('a varredura enxerga o que precisa enxergar (controle positivo)', () => {
  it('achou arquivos de sobra, e o núcleo da cortesia está entre os caminhos', () => {
    expect(TODOS.length, 'varredura de src devolveu quase nada — o caminho mudou?').toBeGreaterThan(100)
    const caminhos = caminhosDaCortesia()
    expect(caminhos).toContain(PRELANCAMENTO)
    expect(caminhos, 'contextoDePlano deixou de importar o núcleo da cortesia').toContain('src/server/services/planos.ts')
    expect(caminhos, 'o cadastro deixou de importar o núcleo da cortesia').toContain('src/server/services/onboarding.ts')
    expect(caminhos.length).toBeGreaterThanOrEqual(3)
  })

  it('o alcance ENXERGA o Mercado Pago quando ele existe: a rota do toque chega no cliente e no serviço', () => {
    // Se o resolvedor de imports quebrasse, "a cortesia não alcança o MP" passaria vazio. O positivo
    // conhecido é a rota que de fato cobra.
    const dali = alcance(ROTA_DO_TOQUE)
    expect(dali.has(SERVICO_ASSINATURA), 'a rota de assinar não alcança o serviço de assinatura: o resolvedor cegou').toBe(true)
    expect(dali.has(CLIENTE_MP), 'a rota de assinar não alcança o cliente do Mercado Pago: o resolvedor cegou').toBe(true)
  })

  it('o detector de chamada casa com a chamada real da rota do toque, e não com o import', () => {
    const rota = CODIGO.get(ROTA_DO_TOQUE) ?? ''
    expect(CHAMADA_DE_COBRANCA.test(rota)).toBe(true)
    expect(CHAMADA_DE_COBRANCA.test("import { iniciarAssinatura } from '@/server/services/assinatura-mp'")).toBe(false)
  })

  it('o leitor de imports ignora `import type` e enxerga import de várias linhas', () => {
    expect(importsDeExecucao("import type { A } from '@/x/a'\nimport { B } from '@/x/b'")).toEqual(['@/x/b'])
    expect(importsDeExecucao("import {\n  A,\n  B,\n} from '@/x/c'")).toEqual(['@/x/c'])
    expect(importsDeExecucao("const m = await import('@/x/d')")).toEqual(['@/x/d'])
  })
})

describe('E5: nenhum caminho da cortesia cobra', () => {
  it('nenhum arquivo da cortesia alcança o cliente do Mercado Pago nem o serviço de assinatura', () => {
    const culpados = caminhosDaCortesia().flatMap((f) => {
      const dali = alcance(f)
      return [CLIENTE_MP, SERVICO_ASSINATURA].filter((mp) => dali.has(mp)).map((mp) => `${f} -> ${mp}`)
    })
    expect(
      culpados,
      `a cortesia passou a alcançar o Mercado Pago: ${culpados.join('; ')}. docs/87 E5: cortesia nunca vira ` +
        'cobrança sem um toque de assinar. Quem cobra é a rota /api/v1/billing/assinar e mais nenhuma.',
    ).toEqual([])
  })

  it('nenhum arquivo da cortesia CHAMA função de cobrança', () => {
    const culpados = caminhosDaCortesia().filter((f) => CHAMADA_DE_COBRANCA.test(CODIGO.get(f) ?? ''))
    expect(culpados, `chamam função de cobrança: ${culpados.join(', ')}`).toEqual([])
  })

  it('criar cobrança tem um chamador só, e é o toque do dono', () => {
    const chamadores = (nome: string, definidoEm: string) =>
      TODOS.filter((f) => f !== definidoEm && new RegExp(`(?<!function\\s+)\\b${nome}\\s*\\(`).test(CODIGO.get(f) ?? ''))

    expect(chamadores('iniciarAssinatura', SERVICO_ASSINATURA)).toEqual([ROTA_DO_TOQUE])
    // `criarPreapproval` é chamada por `iniciarAssinatura`, dentro do próprio serviço de assinatura
    expect(chamadores('criarPreapproval', CLIENTE_MP)).toEqual([SERVICO_ASSINATURA])
    const dentro = CODIGO.get(SERVICO_ASSINATURA) ?? ''
    const corpo = dentro.slice(dentro.indexOf('export async function iniciarAssinatura'))
    expect(corpo.slice(0, corpo.indexOf('\nexport ')), 'criarPreapproval saiu de dentro de iniciarAssinatura').toMatch(/\bcriarPreapproval\s*\(/)
  })
})
