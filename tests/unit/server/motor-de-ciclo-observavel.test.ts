import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { verificarSaude } from '@/server/services/health'

/**
 * O Motor de Ciclo é o diferencial que sustenta o preço do produto (`docs/18`), e até 26/08 era o
 * único job de cron sem vigilância nenhuma.
 *
 * O que aconteceu, medido: nos dias 25 e 26/08 a rota `recompute-cycles` devolveu
 * `{"tenantsProcessados":0}` em TODOS os disparos — cinco por dia — com HTTP 200. O `cron.yml`
 * confere só o código de status (`2xx passa`), então os dez jobs ficaram verdes. Dois dias
 * seguidos sem o produto rodar, e nenhum sinal em lugar nenhum.
 *
 * `send_reminders` e `send_campaigns` já tinham heartbeat e checagem em `/api/health`. O job mais
 * importante não tinha.
 *
 * Este arquivo guarda as duas metades do conserto:
 *  1. o relatório de saúde ACUSA quando o Motor de Ciclo está em silêncio (comportamento real,
 *     com banco encenado — nada de tocar produção, ao contrário de `tests/integration/health`);
 *  2. o heartbeat só é registrado quando houve TRABALHO, não a cada chamada.
 */

const HORA = 60 * 60_000

/** Encena só a superfície que `verificarSaude` toca. `heartbeats` mapeia kind → minutos atrás. */
function bancoFalso(heartbeats: Record<string, number | null>) {
  const construtor = (tabela: string) => {
    let kindPedido = ''
    const encadeavel: Record<string, unknown> = {
      select: () => encadeavel,
      limit: () => encadeavel,
      in: () => encadeavel,
      gte: () => encadeavel,
      lt: () => encadeavel,
      eq: (_coluna: string, valor: string) => {
        kindPedido = valor
        return encadeavel
      },
      maybeSingle: async () => {
        const minutos = heartbeats[kindPedido]
        if (minutos == null) return { data: null, error: null }
        return { data: { last_run_at: new Date(Date.now() - minutos * 60_000).toISOString() }, error: null }
      },
      then: (resolver: (v: unknown) => unknown) =>
        Promise.resolve(
          tabela === 'messages' ? { data: [], error: null } : { count: 0, error: null },
        ).then(resolver),
    }
    return encadeavel
  }
  return { from: (tabela: string) => construtor(tabela) } as never
}

/** Todos os heartbeats recentes, menos os que o caso quiser envelhecer. */
function saudavel(sobrescreve: Record<string, number | null> = {}) {
  return bancoFalso({ send_reminders: 5, send_campaigns: 60, recompute_cycles: 60, ...sobrescreve })
}

describe('o Motor de Ciclo é observável', () => {
  it('o relatório inclui recomputeCycles e está ok quando o job rodou', async () => {
    // Guarda contra o próprio detector: se a chave sumir do relatório, os testes abaixo passariam
    // por comparar `undefined` com `undefined`.
    const r = await verificarSaude(saudavel(), new Date())
    expect(r.checks.recomputeCycles, 'a chave recomputeCycles sumiu do relatório').toBeDefined()
    expect(r.checks.recomputeCycles.ok).toBe(true)
    expect(r.ok).toBe(true)
  })

  it('silêncio do Motor de Ciclo derruba a saúde geral, não só o próprio check', async () => {
    // 27h: mais que o limiar de 26h. É exatamente o cenário dos dias 25 e 26/08 — a rota
    // respondendo 200 todo dia, sem nunca ter processado um tenant.
    const r = await verificarSaude(saudavel({ recompute_cycles: 27 * 60 }), new Date())
    expect(r.checks.recomputeCycles.ok, 'job parado há 27h passou como saudável').toBe(false)
    expect(r.checks.recomputeCycles.detail).toMatch(/recompute_cycles/)
    expect(r.ok, 'o relatório geral ficou ok com o Motor de Ciclo parado').toBe(false)
  })

  it('job que nunca rodou é falha, não ausência silenciosa', async () => {
    const r = await verificarSaude(saudavel({ recompute_cycles: null }), new Date())
    expect(r.checks.recomputeCycles.ok).toBe(false)
    expect(r.checks.recomputeCycles.detail).toMatch(/nunca rodou/)
  })

  it('tolera o atraso real do agendador — 56 min medidos não podem virar alarme', async () => {
    // O agendador atrasou de 36 a 56 min nos cinco disparos de 26/08. Um limiar apertado
    // transformaria isso em alarme diário, e alarme que toca todo dia ninguém mais lê.
    const r = await verificarSaude(saudavel({ recompute_cycles: 25 * HORA / 60_000 }), new Date())
    expect(r.checks.recomputeCycles.ok).toBe(true)
  })
})

describe('o heartbeat do Motor de Ciclo prova TRABALHO, não chamada', () => {
  /*
   * Esta é a distinção que o conserto inteiro carrega, e ela é fácil de perder num refactor:
   * "a rota foi chamada" já era verdade nos dez disparos zerados dos dias 25 e 26. Registrar o
   * heartbeat incondicionalmente reproduziria o mesmo defeito numa camada nova — o `/api/health`
   * ficaria verde justamente enquanto o produto não roda.
   *
   * Teste de fonte, e assumido como tal: casa com a CHAMADA dentro da condição, não com o nome
   * solto de `registrarHeartbeat` (que aparece na linha de `import` por outro motivo — o defeito
   * nº 1 da tabela de guarda cega do `CLAUDE.md`).
   */
  const fonte = readFileSync('src/app/api/cron/recompute-cycles/route.ts', 'utf8')

  it('a leitura do arquivo não voltou vazia', () => {
    expect(fonte.length, 'route.ts de recompute-cycles veio vazio').toBeGreaterThan(400)
    expect(fonte).toMatch(/registrarHeartbeat/)
  })

  it('registra o heartbeat guardado por `processados > 0`', () => {
    const guardado = /if\s*\(\s*processados\s*>\s*0\s*\)[\s\S]{0,200}?registrarHeartbeat\(\s*svc\s*,\s*'recompute_cycles'\s*\)/
    expect(
      guardado.test(fonte),
      'o heartbeat de recompute_cycles precisa ficar DENTRO de `if (processados > 0)` — ' +
        'registrar a cada chamada faz o /api/health ficar verde enquanto o Motor de Ciclo ' +
        'processa zero tenants, que é exatamente o defeito de 25 e 26/08',
    ).toBe(true)
  })
})
