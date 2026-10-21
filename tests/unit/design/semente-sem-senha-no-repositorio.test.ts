import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * Regra 10 do CLAUDE.md, achada quebrada em 15/10/2026 (docs/98-aprimoramento/11 LOJA-23). Dois scripts de semente
 * caíam numa senha FIXA quando a variável de ambiente faltava: `seed-tenant-teste.mjs` ('teste-ciclo-...') e
 * `seed-demo-6-negocios.mjs` ('DemoCiclo#...'). O repositório é público desde 09/09 e os dois rodam contra
 * produção pela mão do Eduardo, inclusive o que criou a conta do revisor da Apple. Esquecer a variável uma vez
 * deixava uma conta de produção com senha que qualquer um lê no GitHub.
 *
 * O certo já existia em `seed-demo-escritorio.mjs`: sem a variável, a senha é sorteada e impressa.
 */
const SCRIPTS = readdirSync('scripts')
  .filter((n) => /^seed-.*\.mjs$/.test(n))
  .map((n) => ({ nome: n, fonte: semComentarios(readFileSync(join('scripts', n), 'utf8')) }))

/** `process.env.ALGO ?? 'texto'` (ou com crase sem `${`): reserva literal para uma variável de senha. */
const RESERVA_FIXA = /process\.env\.[A-Z_]*SENHA[A-Z_]*\s*(\?\?|\|\|)\s*(['"][^'"]*['"]|`[^`$]*`)/

describe('semente não guarda senha no repositório', () => {
  it('a varredura achou os scripts que criam login (piso pelo positivo conhecido)', () => {
    const comSenha = SCRIPTS.filter((s) => /process\.env\.[A-Z_]*SENHA/.test(s.fonte)).map((s) => s.nome)
    expect(comSenha).toEqual(expect.arrayContaining(['seed-tenant-teste.mjs', 'seed-demo-6-negocios.mjs', 'seed-demo-escritorio.mjs']))
  })

  it('o detector reconhece a forma proibida e aceita a sorteada', () => {
    expect(`const SENHA = process.env.SEED_SENHA ?? 'qualquer-coisa'`).toMatch(RESERVA_FIXA)
    expect(`const SENHA = process.env.SEED_SENHA || "x"`).toMatch(RESERVA_FIXA)
    expect('const SENHA = process.env.SEED_SENHA ?? `demo-${randomBytes(6).toString("base64url")}`').not.toMatch(RESERVA_FIXA)
  })

  it.each(SCRIPTS.map((s) => [s.nome, s] as const))('%s não tem senha fixa como reserva', (_nome, s) => {
    expect(s.fonte).not.toMatch(RESERVA_FIXA)
  })
})
