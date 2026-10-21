import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { MIGRATIONS_DO_CODIGO, MIGRATIONS_ESPERADAS, ULTIMA_MIGRATION, compararSchema } from '@/core/schema/versao'

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

  it('MIGRATIONS_DO_CODIGO é a lista do disco, nome por nome', () => {
    expect([...MIGRATIONS_DO_CODIGO]).toEqual(migrationsNoDisco())
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

  it('banco ATRÁS: as três de 05/09 faltando — cita as três, não só a última', () => {
    const todas = aplicadasAteAUltima()
    const estado = compararSchema(todas.slice(0, -3))
    expect(estado.ok).toBe(false)
    for (const nome of todas.slice(-3)) expect(estado.detail).toContain(nome)
  })

  /*
   * O caso que um "confere só a mais recente" não veria — e o motivo de a contagem existir ao lado
   * do nome. Aplicar a última pulando uma do meio é o que acontece quando alguém roda migration à
   * mão, que é exatamente o processo real desta base hoje.
   */
  it('banco ATRÁS com buraco no meio: a última está lá e ainda assim é vermelho, citando qual', () => {
    const todas = aplicadasAteAUltima()
    const estado = compararSchema(todas.filter((_, i) => i !== 5))
    expect(estado.ok).toBe(false)
    expect(estado.detail).toContain(todas[5])
  })

  /*
   * APR-030: o caso que a CONTAGEM não via. Uma do meio faltando e uma aplicada à mão que o código
   * não conhece dão o mesmo total — e o banco passava como em dia, sem a coluna que o código usa.
   */
  it('falta uma do meio e sobra uma de fora: mesmo total, e ainda assim vermelho', () => {
    const todas = aplicadasAteAUltima()
    const trocada = [...todas.filter((_, i) => i !== 40), '9998_aplicada_a_mao']
    expect(trocada).toHaveLength(MIGRATIONS_ESPERADAS)
    const estado = compararSchema(trocada)
    expect(estado.ok).toBe(false)
    expect(estado.detail).toContain(todas[40])
  })

  it('aplicadas pelo CLI (sem o prefixo numérico) contam como as mesmas', () => {
    const peloCli = aplicadasAteAUltima().map((nome) => nome.replace(/^\d+_/, ''))
    expect(compararSchema(peloCli)).toEqual({ ok: true })
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
    expect(estado.detail).toContain('9999_ainda_nao_existe_no_codigo')
  })
})
