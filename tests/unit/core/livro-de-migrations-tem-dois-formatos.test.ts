import { describe, expect, it } from 'vitest'

import { compararSchema, MIGRATIONS_ESPERADAS, ULTIMA_MIGRATION } from '@/core/schema/versao'

/**
 * `supabase_migrations.schema_migrations.name` vem em dois formatos, e a diferença é quem aplicou:
 *
 * - **CLI da Supabase** (`db push`, `start`, `db reset`): parte o arquivo em `version` (o prefixo
 *   numérico) e `name` (só o resto). `0080_historico_...` vira `name = 'historico_...'`.
 * - **À mão pelo SQL Editor**: o `insert` é escrito inteiro, e o costume desta casa gravou o nome
 *   COMPLETO, com prefixo (`docs/runbooks/aplicar-migrations-pendentes.md`).
 *
 * Produção nasceu do segundo jeito, então a comparação por `includes` funcionava — por sorte, não
 * por desenho. Medido em 2026-09-10 num Supabase local recém-criado pelo CLI, com as 80 migrations
 * aplicadas: `/api/health` respondia **503 dizendo "falta a 0080"**.
 *
 * E o estrago real é em produção: no primeiro `supabase db push`, a migration nova entra SEM
 * prefixo, `ULTIMA_MIGRATION` deixa de casar, e a saúde vira 503 logo depois de uma publicação
 * CORRETA — o alarme tocando por causa do próprio conserto.
 */

/** Como o CLI grava: prefixo fora. */
const comoOCliGrava = (nome: string) => nome.replace(/^\d+_/, '')

function listaCompleta(formato: (n: string) => string): string[] {
  // Nomes plausíveis para as anteriores; o que importa é a ÚLTIMA e a contagem.
  const anteriores = Array.from({ length: MIGRATIONS_ESPERADAS - 1 }, (_, i) => formato(`${String(i + 1).padStart(4, '0')}_migration_${i + 1}`))
  return [...anteriores, formato(ULTIMA_MIGRATION)]
}

describe('o livro de migrations é lido nos dois formatos', () => {
  it('nome COM prefixo (aplicado à mão no SQL Editor) passa', () => {
    const r = compararSchema(listaCompleta((n) => n))
    expect(r.ok, r.detail).toBe(true)
    expect(r.detail).toBeUndefined()
  })

  it('nome SEM prefixo (aplicado pelo CLI da Supabase) passa — era este que quebrava', () => {
    const r = compararSchema(listaCompleta(comoOCliGrava))
    expect(
      r.ok,
      'banco em dia, aplicado pelo CLI, sendo reportado como atrasado: `/api/health` devolve 503 ' +
        'depois de um `supabase db push` correto.',
    ).toBe(true)
  })

  it('MISTURADO — o caso de produção depois do primeiro db push', () => {
    /*
     * Produção tem as antigas COM prefixo (postas à mão) e recebe as novas SEM prefixo (postas
     * pelo `db push`). A última é justamente a nova, e é ela que a comparação procura.
     */
    const antigas = Array.from({ length: MIGRATIONS_ESPERADAS - 1 }, (_, i) => `${String(i + 1).padStart(4, '0')}_migration_${i + 1}`)
    const r = compararSchema([...antigas, comoOCliGrava(ULTIMA_MIGRATION)])
    expect(r.ok, r.detail).toBe(true)
  })

  it('e continua reprovando banco de verdade atrasado — o conserto não cegou a vigia', () => {
    // Piso contra o próprio conserto: tirar o prefixo não pode fazer tudo passar.
    const semAUltima = Array.from({ length: MIGRATIONS_ESPERADAS }, (_, i) => `${String(i + 1).padStart(4, '0')}_outra_coisa_${i + 1}`)
    const r = compararSchema(semAUltima)
    expect(r.ok, 'a vigia parou de ver banco atrasado').toBe(false)
    expect(r.detail).toMatch(/ATRÁS do código/)
  })

  it('e continua reprovando quando falta migration do meio', () => {
    const curta = listaCompleta(comoOCliGrava).slice(1) // tem a última, mas uma a menos no total
    const r = compararSchema(curta)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/do meio/)
  })

  it('banco à frente do código continua verde, com o motivo escrito', () => {
    const r = compararSchema([...listaCompleta(comoOCliGrava), 'migration_do_futuro'])
    expect(r.ok).toBe(true)
    expect(r.detail).toMatch(/à frente/)
  })
})
