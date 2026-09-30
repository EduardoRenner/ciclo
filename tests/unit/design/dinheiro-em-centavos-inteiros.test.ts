import { RuleTester } from 'eslint'
import { describe, expect, it } from 'vitest'

import plugin from '../../../eslint-rules/index.mjs'

/**
 * Regra 3 do CLAUDE.md: "Dinheiro em centavos (`bigint`, sufixo `_cents`). Percentual em basis
 * points (`_bps`). Nunca float." Na borda (regra 7, "Zod na borda"), um campo `*Cents`/`*Bps` de
 * schema que aceita fração deixa `19.9` passar como "19 reais e noventa centavos DE CENTAVO" —
 * silencioso até alguém tentar gravar isso numa coluna `bigint` do banco, ou pior, até o Postgres
 * aceitar e a conta ficar errada por uma casa decimal perdida.
 *
 * `ciclo/dinheiro-em-centavos-inteiros` é a versão em AST desta regra — varredura de 2026-09-28
 * não achou nenhuma violação existente no projeto (todo campo já usa `.int()` ou `z.int()`), então
 * nasce direto em `"error"`, sem estágio `"warn"`. Este teste prova que a regra reconhece o padrão
 * certo do errado — não que o código de hoje está limpo (isso é o que `pnpm lint` já prova).
 */

const regra = plugin.rules['dinheiro-em-centavos-inteiros']
if (!regra) throw new Error('a regra `dinheiro-em-centavos-inteiros` sumiu do plugin — este arquivo inteiro passaria vazio')

const ARQUIVO_QUALQUER = 'src/server/services/qualquer.ts'

function erros(codigo: string): number {
  let contagem = 0
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
  try {
    tester.run('dinheiro-em-centavos-inteiros', regra, {
      valid: [{ code: codigo, filename: ARQUIVO_QUALQUER }],
      invalid: [],
    })
  } catch {
    contagem = 1
  }
  return contagem
}

describe('campo *Cents/*Bps de schema Zod precisa ser inteiro', () => {
  it('pega o padrão errado: z.number() sozinho, aceita fração', () => {
    expect(erros('const Esquema = z.object({ priceCents: z.number().nonnegative() })'), 'z.number() sem .int() deixa fração passar — a regra não pegou').toBe(1)
  })

  it('não morde o padrão certo: z.number().int(...)', () => {
    expect(erros('const Esquema = z.object({ priceCents: z.number().int().nonnegative() })'), 'a regra reprovou o próprio conserto').toBe(0)
  })

  it('não morde .int() em qualquer ordem da cadeia', () => {
    expect(erros('const Esquema = z.object({ priceCents: z.number().nonnegative().int() })')).toBe(0)
  })

  it('não morde z.int(...) direto — Zod 4, já é inteiro por natureza', () => {
    expect(erros("const Esquema = z.object({ priceCents: z.int('Informe o preço.').min(0) })")).toBe(0)
  })

  it('pega discountBps e outros campos *Bps, não só *Cents', () => {
    expect(erros('const Esquema = z.object({ discountBps: z.number().max(10000) })'), 'campo *Bps sem .int() não foi pego').toBe(1)
  })

  it('não morde campo que não termina em Cents/Bps', () => {
    expect(erros('const Esquema = z.object({ recents: z.number() })'), 'a regra mordeu um nome que só TERMINA parecido, não o sufixo de verdade').toBe(0)
    expect(erros('const Esquema = z.object({ centsUsados: z.number() })'), 'Cents no MEIO do nome não é o sufixo — não é o campo que a regra vela').toBe(0)
  })

  it('não morde campo que não é schema Zod — referência a variável, não dá pra verificar aqui', () => {
    expect(erros('const objeto = { priceCents: valor }'), 'sem raiz `z.`, a regra não tem como saber o schema — reprovar seria adivinhar').toBe(0)
  })

  it('não morde campo não-numérico (string, boolean) mesmo com o nome errado', () => {
    expect(erros('const Esquema = z.object({ priceCents: z.string() })'), 'campo fora do escopo (não é z.number()/z.int()) não deveria disparar').toBe(0)
  })
})
