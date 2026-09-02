import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Todo valor do enum `vertical_pack` precisa ter catálogo semeado.
 *
 * Esta vigia existe porque a falta dela custou meses em silêncio: o enum prometia nove verticais
 * desde a 0001/0031 e só SEIS tinham pack (`hair`, `tattoo` e `general` não tinham). E o sintoma
 * não era erro — a 0008 ensinou o onboarding a TOLERAR pack ausente, de propósito, para não
 * derrubar o cadastro com 500. Resultado: quem escolhia "cabelo" criava a conta com sucesso e
 * caía num app com ZERO serviço, sem nada para agendar e sem preço nenhum. Ninguém viu porque
 * nada quebrou; só apareceu em 02/09, ao semear um salão de cabelo e o pack não criar linha
 * alguma.
 *
 * A guarda é de MIGRATION, não de banco: quem adiciona uma vertical mexe no SQL, e é aí que o
 * esquecimento acontece. Um teste de integração só acusaria depois de a migration já ter sido
 * aplicada em algum lugar.
 */

const M0001 = readFileSync('supabase/migrations/0001_initial.sql', 'utf8')
const M0031 = readFileSync('supabase/migrations/0031_profession_onboarding.sql', 'utf8')
const M0002 = readFileSync('supabase/migrations/0002_vertical_packs.sql', 'utf8')
const M0057 = readFileSync('supabase/migrations/0057_packs_hair_tattoo_general.sql', 'utf8')

/** Os valores do enum: os da criação em 0001 mais os que `add value` acrescentou depois. */
function verticaisDoEnum(): string[] {
  const criacao = /create type vertical_pack\s+as enum \(([^)]*)\)/.exec(M0001)
  const listaCrua = criacao?.[1]
  if (!listaCrua) throw new Error('não achei `create type vertical_pack` na 0001')
  const iniciais = [...listaCrua.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string)

  const adicionados = [...`${M0031}`.matchAll(/alter type vertical_pack add value '([a-z_]+)'/g)].map(
    (m) => m[1] as string,
  )

  return [...iniciais, ...adicionados]
}

/**
 * Os verticais que ganharam pack. Casa com o valor logo depois do `insert into vertical_packs
 * values (` — que é sempre o primeiro campo, porque a coluna `vertical` é a primeira da tabela.
 */
function verticaisComPack(): string[] {
  const de = (sql: string) =>
    [...sql.matchAll(/insert into vertical_packs values \(\s*'([a-z_]+)'/g)].map((m) => m[1] as string)
  return [...de(M0002), ...de(M0057)]
}

describe('vertical_pack: todo valor do enum tem catálogo', () => {
  it('encontra os dois lados (se um regex parar de casar, o teste vira cego)', () => {
    // Sem isto, um `insert` reescrito com outra formatação zeraria a lista e o teste passaria
    // afirmando que "todos os 0 verticais têm pack".
    expect(verticaisDoEnum().length).toBeGreaterThanOrEqual(9)
    expect(verticaisComPack().length).toBeGreaterThanOrEqual(9)
  })

  it('nenhuma vertical fica sem pack', () => {
    const comPack = new Set(verticaisComPack())
    const semPack = verticaisDoEnum().filter((v) => !comPack.has(v))

    expect(
      semPack,
      `estas verticais existem no enum e não têm catálogo: ${semPack.join(', ')}. ` +
        'Quem criar conta nelas cai num app sem serviço nenhum, e o onboarding NÃO vai reclamar.',
    ).toEqual([])
  })

  it('nenhum pack é semeado para vertical que não existe no enum', () => {
    const doEnum = new Set(verticaisDoEnum())
    const orfaos = verticaisComPack().filter((v) => !doEnum.has(v))

    expect(orfaos, `pack semeado para vertical inexistente: ${orfaos.join(', ')}`).toEqual([])
  })

  it('nenhuma vertical tem pack duplicado', () => {
    const todos = verticaisComPack()
    const vistos = new Set<string>()
    const repetidos = todos.filter((v) => (vistos.has(v) ? true : (vistos.add(v), false)))

    expect(repetidos, `pack duplicado (o insert vai falhar por chave primária): ${repetidos.join(', ')}`).toEqual([])
  })
})
