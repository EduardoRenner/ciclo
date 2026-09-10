import { describe, expect, it } from 'vitest'

import { bancoComLeituraDeMigrationsFalhando, bancoSaudavel } from '../../helpers/saude'

import { verificarSaude } from '@/server/services/health'

/**
 * A vigia de "banco atrás do código" se desligava exatamente quando mais precisava estar ligada.
 *
 * `checarSchema` chama a RPC `migracoes_aplicadas`, e quem cria essa função é a **própria migration
 * 0062**. Se ela não existe, o PostgREST responde `PGRST202` — e até 2026-09-10 isso caía num
 * `ok: true` com o motivo escrito. A intenção era boa e está registrada: durante a publicação da
 * 0062, um vermelho apontaria para a própria vigia, e alarme permanente é o que
 * `core/cron/agendadas.ts` proíbe.
 *
 * O efeito, medido: um banco **antes da 0062** — ou seja, catastroficamente atrasado — reportava
 * `schema: {"ok": true}`. Quanto mais atrás o banco, mais verde o indicador. É a métrica que
 * melhora com o fracasso.
 *
 * Medido no banco do `.env.local` naquele dia: faltavam a `0058` (`v_clientes_a_recuperar`), a
 * `0064` (`cycle_predictions`) e a `0071` (`monthly_profit`); `/admin/hoje` quebrava de verdade no
 * error boundary; `/api/health` dizia que o schema estava OK. E o `scripts/conferir-schema-prod.mjs`
 * (PR #97), que lê exatamente esse `ok`, aprovaria aquele banco.
 *
 * A distinção que o conserto faz, e ela é a coisa toda:
 *
 * - `PGRST202` **prova** que a função não existe → o banco está antes da 0062 → vermelho.
 * - Qualquer outro código é ambíguo de verdade (permissão, rede) → segue verde, mas o texto para
 *   de sugerir que está tudo bem.
 */

describe('a vigia de schema não falha para o verde', () => {
  it('função de migrations ausente (PGRST202) é VERMELHO, não silêncio', async () => {
    const r = await verificarSaude(bancoComLeituraDeMigrationsFalhando('PGRST202'), new Date())
    expect(r.checks.schema.ok, 'banco antes da 0062 voltou a passar como saudável').toBe(false)
    expect(r.checks.schema.detail).toMatch(/ATRÁS do código/)
    // Tem que dizer O QUE FAZER, não só que está errado.
    expect(r.checks.schema.detail).toMatch(/db push/)
  })

  it('e derruba a saúde geral — senão o 503 não acontece e ninguém olha', async () => {
    const r = await verificarSaude(bancoComLeituraDeMigrationsFalhando('PGRST202'), new Date())
    expect(r.ok, 'o relatório geral ficou ok com o banco antes da 0062').toBe(false)
  })

  it('falha AMBÍGUA de leitura continua verde: não dá para provar atraso', async () => {
    // A preocupação original preservada: alarme só sobre o que dá para provar.
    const r = await verificarSaude(bancoComLeituraDeMigrationsFalhando('42501'), new Date())
    expect(r.checks.schema.ok).toBe(true)
  })

  it('mas o texto da falha ambígua para de sugerir que está tudo bem', async () => {
    // O detalhe antigo dizia "vigilância desligada até a 0062 existir neste banco", que se lê como
    // "é normal". Quem passa os olhos no health precisa saber que aquele verde não afirma nada.
    const r = await verificarSaude(bancoComLeituraDeMigrationsFalhando('42501'), new Date())
    expect(r.checks.schema.detail, 'o verde ambíguo voltou a se vender como saudável').toMatch(
      /NÃO quer dizer que o banco está em dia/,
    )
  })

  it('banco em dia continua verde — a guarda não é alarme novo', async () => {
    // Piso contra o próprio conserto: se isto ficasse vermelho, o alarme permanente que a intenção
    // original queria evitar teria voltado por outra porta.
    const r = await verificarSaude(bancoSaudavel(), new Date())
    expect(r.checks.schema.ok).toBe(true)
    expect(r.checks.schema.detail).toBeUndefined()
  })
})
