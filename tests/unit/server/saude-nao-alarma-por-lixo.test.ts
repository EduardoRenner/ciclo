import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { verificarSaude } from '@/server/services/health'
import { ERRO_SEM_HANDLER, semHandlerRegistrado } from '@/server/services/job-queue'

/**
 * O irmão de `saude-vigia-so-o-que-roda.test.ts`, e a razão de ele não ter bastado.
 *
 * Aquele teste consertou a vigilância de HEARTBEAT: um job de cron que ninguém dispara não pode
 * ser cobrado por atraso, senão o endpoint fica vermelho para sempre e o vermelho que importa
 * some no meio. A lição está escrita em `src/core/cron/agendadas.ts`.
 *
 * **O mesmo defeito continuou vivo na checagem ao lado**, a da fila — e custou de novo. Medido na
 * produção em 2026-08-30: `/api/health` em **503** com `1 job(s) parado(s) há mais de 15 min`,
 * sem defeito nenhum. A fila tinha 20+ jobs de tipo `teste_saude` e `seed`, resíduo de fixture
 * despejado pela suíte de teste (`.env.local` aponta para produção, achado A1), e `HANDLERS` em
 * `src/app/api/cron/jobs/route.ts` está VAZIO. Nenhum deles podia ser processado, nunca: falhavam,
 * voltavam para `failed`, e eram recontados como "parados" no disparo seguinte, indefinidamente.
 *
 * É o padrão que a super auditoria nomeou como o achado mais reusável desta base: **um conserto
 * certo, aplicado num lugar só.**
 *
 * A regra que este arquivo guarda: job de tipo **conhecido** parado é alarme de verdade; job de
 * tipo **sem handler** é lixo — aparece no relatório, com o nome do tipo, e não pinta o endpoint
 * de vermelho.
 */

/** Um `db` de mentira que devolve as linhas de `job_queue` que o teste quiser. */
function bancoFalso(jobs: { kind: string; status: string; last_error?: string | null }[]) {
  const tabela = (nome: string) => {
    if (nome === 'job_queue') {
      const construtor = {
        _status: [] as string[],
        select: () => construtor,
        in: (_c: string, valores: string[]) => {
          construtor._status = valores
          return construtor
        },
        eq: (_c: string, valor: string) => {
          construtor._status = [valor]
          return construtor
        },
        lt: () =>
          Promise.resolve({
            data: jobs
              .filter((j) => construtor._status.includes(j.status))
              .map((j) => ({ kind: j.kind, last_error: j.last_error ?? null })),
            error: null,
          }),
      }
      return construtor
    }
    // As outras checagens não são o assunto deste teste — devolvem "tudo bem".
    return {
      select: () => ({
        limit: () => Promise.resolve({ error: null }),
        gte: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { last_run_at: new Date().toISOString() }, error: null }) }),
      }),
    }
  }
  /*
   * `rpc` devolve erro de propósito: este teste é sobre a fila, e a checagem de schema tem que ser
   * indiferente a ele. `checarSchema` trata falha de leitura como verde-com-motivo (é ela mesma que
   * a migration 0062 cria, então todo banco que ainda não a aplicou cai aqui) — se algum dia isso
   * virar vermelho, estes seis casos ficam vermelhos junto e denunciam a mudança.
   */
  return { from: tabela, rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) } as never
}

describe('a leitura deste teste', () => {
  it('o banco falso devolve o que a checagem de fila pede', async () => {
    // Guarda contra o teste inteiro passar vazio se o mock parar de casar com o código.
    const r = await verificarSaude(bancoFalso([{ kind: 'qualquer', status: 'failed', last_error: `${ERRO_SEM_HANDLER} "qualquer".` }]))
    expect(r.checks.jobQueue.detail, 'o mock não chegou na checagem de fila').toBeDefined()
  })
})

describe('lixo na fila não pinta o endpoint de vermelho', () => {
  it('job de tipo SEM handler não derruba a saúde, mas aparece escrito', async () => {
    const r = await verificarSaude(bancoFalso([
      { kind: 'teste_saude', status: 'failed', last_error: `${ERRO_SEM_HANDLER} "teste_saude".` },
      { kind: 'seed', status: 'failed', last_error: `${ERRO_SEM_HANDLER} "seed".` },
    ]))

    expect(
      r.checks.jobQueue.ok,
      'job que nenhum handler sabe processar não pode contar como fila parada — ele nunca vai ' +
        'drenar, então o 503 seria permanente, e um alarme que toca todo dia esconde o dia em que ' +
        'algo quebra de verdade (a mesma lição de src/core/cron/agendadas.ts)',
    ).toBe(true)

    expect(r.checks.jobQueue.detail, 'o lixo tem que aparecer no relatório — esconder é o erro oposto').toContain('sem handler')
    expect(r.checks.jobQueue.detail, 'o relatório precisa dizer QUAIS tipos, senão não dá para agir').toContain('teste_saude')
    expect(r.checks.jobQueue.detail).toContain('seed')
  })

  it('sem nenhum job parado, a fila fica limpa e calada', async () => {
    const r = await verificarSaude(bancoFalso([]))
    expect(r.checks.jobQueue.ok).toBe(true)
    expect(r.checks.jobQueue.detail).toBeUndefined()
  })
})

describe('job que PODE ser processado continua sendo alarme', () => {
  /*
   * O contrapeso, e a razão de este teste existir na forma atual. A primeira versão do conserto
   * manteve um registro paralelo dos tipos com handler e silenciava todo o resto — a CI reprovou,
   * porque com o registro vazio NENHUM job podia disparar o alarme e dois testes de integração
   * que provam "trabalho parado acusa" quebraram. Silenciar demais é o defeito oposto, e pior:
   * trabalho enfileirado sumindo em silêncio é o que o §7 da espec proíbe.
   */
  it('job parado sem erro nenhum (worker não rodou) derruba a saúde', async () => {
    const r = await verificarSaude(bancoFalso([{ kind: 'send_reminders', status: 'queued', last_error: null }]))
    expect(
      r.checks.jobQueue.ok,
      'job enfileirado que nunca foi tentado é fila crescendo — tem que alarmar, é a metade que ' +
        'o conserto do lixo NÃO pode engolir',
    ).toBe(false)
    expect(r.checks.jobQueue.detail).toMatch(/parado\(s\)/)
  })

  it('job que falhou por OUTRO motivo derruba a saúde', async () => {
    const r = await verificarSaude(bancoFalso([{ kind: 'send_reminders', status: 'failed', last_error: 'timeout do provedor' }]))
    expect(r.checks.jobQueue.ok, 'falha real não pode ser confundida com lixo').toBe(false)
  })

  it('lixo e trabalho de verdade convivem: alarma, e conta os dois separados', async () => {
    const r = await verificarSaude(bancoFalso([
      { kind: 'teste_saude', status: 'failed', last_error: `${ERRO_SEM_HANDLER} "teste_saude".` },
      { kind: 'send_reminders', status: 'queued', last_error: null },
    ]))
    expect(r.checks.jobQueue.ok).toBe(false)
    expect(r.checks.jobQueue.detail, 'o job de verdade tem que aparecer').toMatch(/1 job\(s\) parado\(s\)/)
    expect(r.checks.jobQueue.detail, 'e o lixo também, sem inflar a contagem do de verdade').toContain('sem handler')
  })

  it('a dispensa é estreita — casa com o começo da mensagem, não com "parece lixo"', () => {
    expect(semHandlerRegistrado(`${ERRO_SEM_HANDLER} "x".`)).toBe(true)
    expect(semHandlerRegistrado(null)).toBe(false)
    expect(semHandlerRegistrado('timeout')).toBe(false)
    // Não pode bastar mencionar a frase no meio de outro erro.
    expect(semHandlerRegistrado(`falhou porque: ${ERRO_SEM_HANDLER} "x".`)).toBe(false)
  })
})

describe('a mensagem de erro é fonte única', () => {
  /**
   * `job-queue.ts` GRAVA a mensagem e `health.ts` a RECONHECE. Se as duas fossem cópias de string,
   * mudar o texto do `throw` deixaria o reconhecedor cego em silêncio — e o 503 permanente
   * voltaria sem ninguém notar. Por isso a constante é exportada e usada nos dois lados; este caso
   * prova que quem grava usa mesmo a constante.
   */
  it('o throw da fila usa a constante exportada, não uma cópia literal', () => {
    const fonte = readFileSync('src/server/services/job-queue.ts', 'utf8')
    expect(
      /throw new Error\(`\$\{ERRO_SEM_HANDLER\}/.test(fonte),
      'job-queue.ts voltou a montar a mensagem à mão. health.ts reconhece o erro por essa ' +
        'constante: uma cópia literal aqui deixa o reconhecedor cego no dia em que o texto mudar.',
    ).toBe(true)
  })
})
