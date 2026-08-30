import { decidirDesfecho } from '@/core/jobs/backoff'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * O começo da mensagem que um job sem handler grava em `last_error`.
 *
 * Vive aqui, exportado, porque `/api/health` precisa RECONHECER esse erro — e reconhecer por
 * cópia da string seria a duplicação silenciosa de sempre. Ver `semHandlerRegistrado()`.
 */
export const ERRO_SEM_HANDLER = 'Nenhum handler registrado para o tipo de job'

/**
 * Este job falhou porque ninguém sabe processar o tipo dele?
 *
 * **Por que `/api/health` precisa dessa distinção.** Medido na produção em 2026-08-30: o endpoint
 * devolvia 503 com `1 job(s) parado(s) há mais de 15 min`, sem defeito nenhum. A fila tinha 20+
 * jobs de tipo `teste_saude` e `seed` — resíduo de fixture despejado pela suíte de teste
 * (`.env.local` aponta para produção, achado A1) — e o registro de handlers está vazio, porque os
 * handlers reais chegam nos tickets que os pedem. Nenhum deles PODE ser processado: falham,
 * voltam para `failed`, e são recontados como "parados" no disparo seguinte, para sempre.
 *
 * É o mesmo defeito que `src/core/cron/agendadas.ts` já consertou para os heartbeats em 26/08,
 * com a lição escrita lá: *alarme que toca todo dia por um motivo conhecido esconde o dia em que
 * algo quebra de verdade.* O conserto foi aplicado à vigilância de heartbeat e não à da fila, que
 * fazia a mesma coisa ao lado — o padrão que a super auditoria nomeou como o achado mais reusável
 * desta base: **um conserto certo, aplicado num lugar só.**
 *
 * **Por que casa com o ERRO e não com uma lista de tipos conhecidos.** A primeira tentativa
 * manteve um registro paralelo dos tipos que têm handler, e a CI reprovou: com o registro vazio,
 * NENHUM job podia disparar o alarme, e dois testes de integração que provam "trabalho parado
 * acusa" quebraram. O erro gravado é o sinal honesto — ele diz o que de fato aconteceu com aquele
 * job, não o que uma lista afirma sobre o mundo. Fila crescendo por worker que não roda continua
 * alarmando, que é como tem que ser.
 */
export function semHandlerRegistrado(lastError: string | null): boolean {
  return lastError !== null && lastError.startsWith(ERRO_SEM_HANDLER)
}
type LinhaJob = Database['public']['Tables']['job_queue']['Row']

export type Job<Payload = Record<string, unknown>> = Omit<LinhaJob, 'payload'> & { payload: Payload }

export type ManipuladorDeJob = (job: Job) => Promise<void>

export type EntradaEnfileirar = {
  tenantId?: string | null
  kind: string
  payload: Record<string, unknown>
  runAfter?: string
  maxAttempts?: number
  /** Vira `payload.dedupe_key` — é o que o índice único da 0001 usa para nunca duplicar o mesmo trabalho. */
  dedupeKey?: string
}

/**
 * §7: dedupe é por `(kind, payload->>'dedupe_key')` enquanto o job está
 * `queued`/`running` — chamar `enfileirar` duas vezes para o mesmo lembrete
 * (por exemplo) é um no-op silencioso, não erro. É o mesmo espírito do
 * `on conflict` que o resto do projeto usa para idempotência.
 */
export async function enfileirar(db: Cliente, entrada: EntradaEnfileirar): Promise<{ id: number } | null> {
  const payload = entrada.dedupeKey ? { ...entrada.payload, dedupe_key: entrada.dedupeKey } : entrada.payload

  const { data, error } = await db
    .from('job_queue')
    .insert({
      tenant_id: entrada.tenantId ?? null,
      kind: entrada.kind,
      payload: payload as never,
      run_after: entrada.runAfter ?? new Date().toISOString(),
      max_attempts: entrada.maxAttempts ?? 5,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return null // já tinha um job igual na fila
    throw new AppError('INTERNAL', { cause: error })
  }
  return data
}

/**
 * Reivindica até `limite` jobs prontos (`claim_jobs`, migration 0009 — o
 * `SELECT ... FOR UPDATE SKIP LOCKED` inteiro roda no banco, não em duas idas
 * do PostgREST) e chama `handlers[job.kind]` para cada um. Job de tipo sem
 * handler registrado marca `dead` na hora — silêncio ali seria pior que
 * reprovar, porque ninguém saberia que aquele tipo nunca roda.
 */
export async function processarLote(
  db: Cliente,
  handlers: Record<string, ManipuladorDeJob>,
  limite = 50,
): Promise<{ processados: number; falharam: number; mortos: number }> {
  const { data: jobs, error } = await db.rpc('claim_jobs', { p_limit: limite })
  if (error) throw new AppError('INTERNAL', { cause: error })

  let processados = 0
  let falharam = 0
  let mortos = 0

  for (const job of jobs ?? []) {
    const handler = handlers[job.kind]

    try {
      if (!handler) throw new Error(`${ERRO_SEM_HANDLER} "${job.kind}".`)
      await handler(job as Job)
      const { error: erroFim } = await db.rpc('finish_job', { p_id: job.id, p_status: 'done' })
      if (erroFim) throw erroFim
      processados++
    } catch (erro) {
      const desfecho = decidirDesfecho(job.attempts, job.max_attempts)
      const mensagem = erro instanceof Error ? erro.message : String(erro)
      const { error: erroFim } = await db.rpc('finish_job', { p_id: job.id, p_status: desfecho, p_error: mensagem })
      if (erroFim) throw new AppError('INTERNAL', { cause: erroFim })
      if (desfecho === 'dead') mortos++
      else falharam++
    }
  }

  return { processados, falharam, mortos }
}
