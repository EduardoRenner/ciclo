import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { MIGRATIONS_ESPERADAS, ULTIMA_MIGRATION, compararSchema } from '@/core/schema/versao'

/**
 * O irmão de `saude-vigia-so-o-que-roda`, para a outra cópia que o runtime não consegue ler.
 *
 * `supabase/migrations/` não entra no bundle da Vercel, então em produção não há diretório para
 * contar — as duas constantes de `core/schema/versao.ts` são uma cópia do disco, e cópia sem guarda
 * apodrece. O defeito que ela evita é específico: a constante para de acompanhar os arquivos, a
 * checagem passa a comparar o schema com um número velho, e volta a dizer "tudo certo" exatamente
 * no caso em que existe migration nova sem aplicar — que é o caso de 05/09/2026 que a criou.
 */

const DIR = 'supabase/migrations'

function migrationsNoDisco(): string[] {
  return readdirSync(DIR)
    .filter((nome) => nome.endsWith('.sql'))
    .map((nome) => nome.replace(/\.sql$/, ''))
    .sort()
}

describe('as constantes de schema espelham o disco', () => {
  it('MIGRATIONS_ESPERADAS é a contagem de arquivos em supabase/migrations', () => {
    const noDisco = migrationsNoDisco()
    expect(noDisco.length, 'nenhuma migration encontrada — o caminho mudou?').toBeGreaterThan(0)
    expect(
      MIGRATIONS_ESPERADAS,
      'criou migration nova? atualize MIGRATIONS_ESPERADAS e ULTIMA_MIGRATION em ' +
        'src/core/schema/versao.ts — e aplique no banco de produção, que não tem Action para isso',
    ).toBe(noDisco.length)
  })

  it('ULTIMA_MIGRATION é o arquivo de maior número', () => {
    const noDisco = migrationsNoDisco()
    expect(ULTIMA_MIGRATION).toBe(noDisco[noDisco.length - 1])
  })

  it('o prefixo numérico é único — dois arquivos com o mesmo número quebrariam a contagem', () => {
    const prefixos = migrationsNoDisco().map((nome) => nome.slice(0, 4))
    expect(new Set(prefixos).size).toBe(prefixos.length)
  })
})

describe('compararSchema decide pela direção da diferença', () => {
  const aplicadasAteAUltima = (): string[] => migrationsNoDisco()

  it('banco em dia: ok e sem ruído', () => {
    expect(compararSchema(aplicadasAteAUltima())).toEqual({ ok: true })
  })

  it('banco ATRÁS: falta a última — vermelho, e o texto diz qual', () => {
    const semAUltima = aplicadasAteAUltima().filter((nome) => nome !== ULTIMA_MIGRATION)
    const estado = compararSchema(semAUltima)
    expect(estado.ok).toBe(false)
    expect(estado.detail).toContain(ULTIMA_MIGRATION)
    expect(estado.detail).toContain('ATRÁS')
  })

  it('banco ATRÁS: as três de 05/09 faltando — conta quantas, não só a última', () => {
    const tresAMenos = aplicadasAteAUltima().slice(0, -3)
    const estado = compararSchema(tresAMenos)
    expect(estado.ok).toBe(false)
    expect(estado.detail).toContain('e mais 2')
  })

  /*
   * O caso que um "confere só a mais recente" não veria — e o motivo de a contagem existir ao lado
   * do nome. Aplicar a última pulando uma do meio é o que acontece quando alguém roda migration à
   * mão, que é exatamente o processo real desta base hoje.
   */
  it('banco ATRÁS com buraco no meio: a última está lá e ainda assim é vermelho', () => {
    const comBuraco = aplicadasAteAUltima().filter((_, i) => i !== 5)
    const estado = compararSchema(comBuraco)
    expect(estado.ok).toBe(false)
    expect(estado.detail).toContain('do meio')
  })

  /*
   * Migration aditiva antes do deploy é a ordem SEGURA de publicar. Se isto ficasse vermelho, a
   * guarda estaria ensinando a fazer na ordem perigosa — e o alarme tocaria em toda publicação
   * normal, que é como alarme deixa de ser lido.
   */
  it('banco À FRENTE: verde, com o motivo escrito', () => {
    const comUmaAMais = [...aplicadasAteAUltima(), '9999_ainda_nao_existe_no_codigo']
    const estado = compararSchema(comUmaAMais)
    expect(estado.ok).toBe(true)
    expect(estado.detail).toContain('à frente')
  })
})
