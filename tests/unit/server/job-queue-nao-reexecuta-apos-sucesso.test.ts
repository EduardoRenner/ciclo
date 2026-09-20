import { describe, expect, it, vi } from 'vitest'

import { processarLote } from '@/server/services/job-queue'

/**
 * `tests/integration/job-queue.test.ts` cobre o caminho feliz e o handler ausente contra o banco
 * de verdade — mas não alcança o caso que só aparece quando o handler TERMINA e a ESCRITA do
 * resultado falha depois, porque simular essa ordem exata (RPC 1 ok, RPC 2 falha) contra Postgres
 * de verdade exigiria derrubar a conexão no meio de duas chamadas. Fake de `db.rpc` alcança.
 *
 * O caso: `finish_job('done')` falha DEPOIS do handler já ter rodado com sucesso. Antes desta
 * correção, o `throw erroFim` caía no mesmo `catch` que trata handler que falhou de verdade — o
 * job era marcado `failed`/`dead` e reexecutado na próxima passada, rodando de novo um handler que
 * já tinha completado (mensagem duplicada, cobrança duplicada, o que o handler fizer).
 */

function fakeDb(job: { id: number; kind: string; attempts: number; max_attempts: number }, respostaFinishJob: { error: unknown }) {
  const chamadasFinishJob: { p_status: string; p_error?: string }[] = []

  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => {
    if (fn === 'claim_jobs') return Promise.resolve({ data: [job], error: null })
    if (fn === 'finish_job') {
      chamadasFinishJob.push({ p_status: args.p_status as string, p_error: args.p_error as string | undefined })
      return Promise.resolve(respostaFinishJob)
    }
    throw new Error(`RPC inesperada no fake: ${fn}`)
  })

  return { db: { rpc } as unknown as Parameters<typeof processarLote>[0], chamadasFinishJob }
}

describe('processarLote — handler bem-sucedido cuja gravação de `done` falha', () => {
  it('NÃO marca o job como failed/dead — ficaria preso em `running`, não reexecuta', async () => {
    const job = { id: 1, kind: 'teste', attempts: 0, max_attempts: 5 }
    const { db, chamadasFinishJob } = fakeDb(job, { error: new Error('conexão caiu na escrita') })

    const avisos: unknown[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => avisos.push(args))

    let handlerRodou = 0
    const resultado = await processarLote(db, {
      teste: async () => {
        handlerRodou++
      },
    })
    vi.restoreAllMocks()

    expect(handlerRodou, 'o handler tem que ter rodado uma vez — é a premissa do cenário').toBe(1)

    // A asserção que prova o defeito: só houve UMA chamada a finish_job, pedindo 'done' — nunca
    // uma segunda chamada pedindo 'failed'/'dead' pelo mesmo job.
    expect(chamadasFinishJob).toHaveLength(1)
    expect(chamadasFinishJob[0]!.p_status).toBe('done')

    // Nem processado (a gravação falhou) nem contado como falha/morto — fica de fora dos três
    // contadores, porque nenhum deles descreve "trabalho feito, contabilidade pendente".
    expect(resultado).toEqual({ processados: 0, falharam: 0, mortos: 0 })
    expect(avisos.join(' ')).toContain('job_concluido_sem_registro')
  })
})
