import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { TIPOS_DE_JOB_COM_HANDLER, tipoDeJobTemHandler } from '@/core/jobs/registro'
import { verificarSaude } from '@/server/services/health'

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
function bancoFalso(jobs: { kind: string; status: string }[]) {
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
        lt: () => Promise.resolve({ data: jobs.filter((j) => construtor._status.includes(j.status)).map((j) => ({ kind: j.kind })), error: null }),
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
  return { from: tabela } as never
}

describe('a leitura deste teste', () => {
  it('o banco falso devolve o que a checagem de fila pede', async () => {
    // Guarda contra o teste inteiro passar vazio se o mock parar de casar com o código.
    const r = await verificarSaude(bancoFalso([{ kind: 'qualquer', status: 'failed' }]))
    expect(r.checks.jobQueue.detail, 'o mock não chegou na checagem de fila').toBeDefined()
  })
})

describe('lixo na fila não pinta o endpoint de vermelho', () => {
  it('job de tipo SEM handler não derruba a saúde, mas aparece escrito', async () => {
    const r = await verificarSaude(bancoFalso([
      { kind: 'teste_saude', status: 'failed' },
      { kind: 'seed', status: 'failed' },
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

describe('job de tipo conhecido parado CONTINUA sendo alarme', () => {
  /*
   * O contrapeso do teste acima. Se a dispensa do lixo crescer e passar a engolir job de verdade,
   * a fila para de ser vigiada — que é o defeito oposto, e pior: trabalho enfileirado sumindo em
   * silêncio é o que o §7 da espec proíbe.
   *
   * `TIPOS_DE_JOB_COM_HANDLER` está vazio hoje (nenhum handler foi escrito ainda), então este
   * caso exercita a função de decisão direto, em vez de depender de um tipo real existir.
   */
  it('a decisão distingue tipo conhecido de desconhecido', () => {
    expect(tipoDeJobTemHandler('tipo_que_ninguem_registrou')).toBe(false)
    for (const tipo of TIPOS_DE_JOB_COM_HANDLER) {
      expect(tipoDeJobTemHandler(tipo), `${tipo} está no registro mas a função não o reconhece`).toBe(true)
    }
  })

  it('a dispensa é estreita — não vale para qualquer coisa parecida com lixo', () => {
    // Se um dia alguém trocar a checagem por "nome que começa com teste_", isto reprova.
    expect(tipoDeJobTemHandler('teste_saude')).toBe(false)
    expect(tipoDeJobTemHandler('send_reminders')).toBe(false) // ainda não tem handler — e é honesto
  })
})

describe('as duas listas de handler não podem divergir', () => {
  /**
   * `HANDLERS` mora na rota e `TIPOS_DE_JOB_COM_HANDLER` no core, porque um serviço não pode
   * importar de `app/api/.../route.ts` sem inverter a direção das dependências. Duplicação
   * vigiada é segura; duplicação silenciosa é como um handler novo nasce invisível para a
   * vigilância — o job dele passaria a ter quem o processe e, no mesmo instante, deixaria de ser
   * cobrado quando parasse.
   */
  const ROTA = 'src/app/api/cron/jobs/route.ts'

  function chavesDoHandlerNaRota(): string[] {
    const fonte = readFileSync(ROTA, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

    /*
     * Delimita pela CHAVE de abertura do objeto até a que a fecha, contando profundidade — não
     * por um regex do tipo. O tipo é `Record<string, (job: unknown) => Promise<void>>`, e um
     * `[^>]*` para no primeiro `>` de `=>`: a primeira versão deste teste não achou nada e
     * reprovou por isso, que é o comportamento certo de um detector que perde o alvo, mas
     * inutilizaria a guarda.
     */
    const inicio = fonte.indexOf('{', fonte.indexOf('HANDLERS'))
    expect(inicio, `não achei o objeto HANDLERS em ${ROTA} — o teste precisa ser atualizado junto`).toBeGreaterThan(-1)

    let profundidade = 0
    let fim = inicio
    for (; fim < fonte.length; fim++) {
      if (fonte[fim] === '{') profundidade++
      else if (fonte[fim] === '}' && --profundidade === 0) break
    }

    const corpo = fonte.slice(inicio + 1, fim)
    return [...corpo.matchAll(/['"]?([a-z_][a-z0-9_]*)['"]?\s*:/gi)].map((x) => x[1]!).sort()
  }

  it('a rota e o registro do core listam os mesmos tipos', () => {
    expect(chavesDoHandlerNaRota()).toEqual([...TIPOS_DE_JOB_COM_HANDLER].sort())
  })
})
