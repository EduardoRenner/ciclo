import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'

import plugin from '../../../eslint-rules/index.mjs'

/**
 * Achado da auditoria de 2026-09-08.
 *
 * `ciclo/service-client-confinado` é a versão executável da regra inviolável nº 2 do CLAUDE.md:
 * a chave de `service_role` passa por cima da RLS, então ela mora num arquivo só, onde dá para
 * revisar. Se vazar para uma rota de usuário, o isolamento entre tenants deixa de existir.
 *
 * A regra visitava **só `Identifier`**. Em `process.env['SUPABASE_SERVICE_ROLE_KEY']` o nome da
 * chave é um `Literal`, não um `Identifier` — o visitante nunca era chamado e o lint passava
 * verde. A forma mais fácil de burlar a regra era a única que ela não enxergava.
 *
 * Isso importa mais do que parece: trocar `.X` por `['X']` é o que alguém faz sem pensar para
 * calar um lint que acha exagerado, e não deixa rastro nenhum — ao contrário de um
 * `// eslint-disable`, que aparece na revisão.
 *
 * ## Por que um teste, se `pnpm lint` já roda em toda a base
 *
 * Porque `lint` prova que **o código de hoje** não infringe; não prova que a regra pegaria a
 * infração. É a mesma diferença entre "a suíte está verde" e "a guarda funciona" que o
 * `CLAUDE.md` persegue, e aqui ela é gritante: com o buraco aberto, `pnpm lint` ficava verde
 * exatamente porque ninguém tinha usado o colchete ainda.
 *
 * `RuleTester` do próprio ESLint, que é quem sabe montar o AST de verdade — inventar um AST à
 * mão testaria a minha imaginação, não o parser.
 */

const regra = plugin.rules['service-client-confinado']
if (!regra) throw new Error('a regra `service-client-confinado` sumiu do plugin — este arquivo inteiro passaria vazio')

/** Fora do wrapper: é o caso em que a regra tem que morder. */
const ARQUIVO_QUALQUER = 'src/app/api/v1/clients/route.ts'

function erros(codigo: string, arquivo = ARQUIVO_QUALQUER): number {
  let contagem = 0
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
  try {
    tester.run('service-client-confinado', regra, {
      valid: [{ code: codigo, filename: arquivo }],
      invalid: [],
    })
  } catch {
    contagem = 1
  }
  return contagem
}

describe('a chave de service_role não escapa mudando a grafia', () => {
  it('pega o acesso por ponto — o caso que a regra já cobria', () => {
    expect(erros('const k = process.env.SUPABASE_SERVICE_ROLE_KEY'), 'a regra parou de pegar o caso básico').toBe(1)
  })

  it('pega o acesso por COLCHETE, que era o buraco', () => {
    expect(
      erros("const k = process.env['SUPABASE_SERVICE_ROLE_KEY']"),
      'em `env["X"]` o nome é um Literal, não um Identifier — era assim que a regra era burlada sem deixar rastro',
    ).toBe(1)
  })

  it('pega a crase, que é a terceira grafia da mesma coisa', () => {
    expect(erros('const k = process.env[`SUPABASE_SERVICE_ROLE_KEY`]')).toBe(1)
  })

  it('pega `createServiceClient` nas três grafias também', () => {
    expect(erros('createServiceClient()')).toBe(1)
    expect(erros("const f = mod['createServiceClient']")).toBe(1)
    expect(erros('const f = mod[`createServiceClient`]')).toBe(1)
  })

  it('não morde dentro do wrapper, que é onde a chave tem o direito de morar', () => {
    expect(
      erros("const k = process.env['SUPABASE_SERVICE_ROLE_KEY']", 'src/server/db/with-tenant.ts'),
      'a regra passou a reprovar o único arquivo que pode usar a chave',
    ).toBe(0)
  })

  it('não morde a menção dentro de uma frase', () => {
    /*
     * O custo simétrico da guarda cega: detector que reprova o certo manda alguém "consertar"
     * código bom. As mensagens de erro dos testes de integração citam o nome no meio de uma
     * frase ("precisa de ... e SUPABASE_SERVICE_ROLE_KEY no .env.local"), e comparação por
     * `includes` acusaria todas elas.
     */
    expect(erros("throw new Error('falta SUPABASE_SERVICE_ROLE_KEY no .env.local')")).toBe(0)
  })

  it('não morde nomes parecidos', () => {
    expect(erros('const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY')).toBe(0)
    expect(erros("const k = process.env['SUPABASE_SERVICE_ROLE_KEY_ANTIGA']")).toBe(0)
  })
})
