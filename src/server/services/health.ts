import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const LIMIAR_FILA_PARADA_MIN = 15
const LIMIAR_HEARTBEAT_MIN = 30
const LIMIAR_FALHA_MENSAGEM = 0.05 // 5%, J129

export async function registrarHeartbeat(db: Cliente, kind: string): Promise<void> {
  const { error } = await db.from('cron_heartbeats').upsert({ kind, last_run_at: new Date().toISOString() }, { onConflict: 'kind' })
  if (error) throw new AppError('INTERNAL', { cause: error })
}

export type ChecagemSaude = {
  ok: boolean
  detail?: string
}

export type RelatorioSaude = {
  ok: boolean
  checks: {
    database: ChecagemSaude
    jobQueue: ChecagemSaude
    messages: ChecagemSaude
    sendReminders: ChecagemSaude
  }
}

/**
 * TICKET-058/J129: "/api/health que checa banco, fila e PSP. Alerta se: fila com item parado
 * >15min, taxa de erro 5xx >1%, mensagem failed >5% na hora, job send_reminders sem execução em
 * 30min." Taxa de erro 5xx não entra aqui — é métrica de request HTTP (Sentry/Vercel Analytics
 * já cobrem, sem endpoint próprio pra checar); PSP (Asaas) também fica de fora — TICKET-031/043
 * ainda bloqueados por credencial, nada pra checar até existir.
 */
export async function verificarSaude(db: Cliente, agora: Date = new Date()): Promise<RelatorioSaude> {
  const database = await checarBanco(db)
  const jobQueue = await checarFila(db, agora)
  const messages = await checarMensagens(db, agora)
  const sendReminders = await checarHeartbeat(db, 'send_reminders', agora)

  return {
    ok: database.ok && jobQueue.ok && messages.ok && sendReminders.ok,
    checks: { database, jobQueue, messages, sendReminders },
  }
}

async function checarBanco(db: Cliente): Promise<ChecagemSaude> {
  const { error } = await db.from('tenants').select('id', { head: true, count: 'exact' }).limit(1)
  return error ? { ok: false, detail: error.message } : { ok: true }
}

async function checarFila(db: Cliente, agora: Date): Promise<ChecagemSaude> {
  const limite = new Date(agora.getTime() - LIMIAR_FILA_PARADA_MIN * 60_000).toISOString()
  const { count, error } = await db.from('job_queue').select('id', { head: true, count: 'exact' }).in('status', ['queued', 'failed']).lt('run_after', limite)
  if (error) return { ok: false, detail: error.message }
  const parados = count ?? 0
  return parados === 0 ? { ok: true } : { ok: false, detail: `${parados} job(s) parado(s) há mais de ${LIMIAR_FILA_PARADA_MIN} min` }
}

async function checarMensagens(db: Cliente, agora: Date): Promise<ChecagemSaude> {
  const umaHoraAtras = new Date(agora.getTime() - 3_600_000).toISOString()
  const { data, error } = await db.from('messages').select('status').gte('created_at', umaHoraAtras)
  if (error) return { ok: false, detail: error.message }
  if (!data || data.length === 0) return { ok: true }

  const falhas = data.filter((m) => m.status === 'failed').length
  const taxa = falhas / data.length
  return taxa <= LIMIAR_FALHA_MENSAGEM ? { ok: true } : { ok: false, detail: `${(taxa * 100).toFixed(1)}% de falha na última hora (limite ${LIMIAR_FALHA_MENSAGEM * 100}%)` }
}

async function checarHeartbeat(db: Cliente, kind: string, agora: Date): Promise<ChecagemSaude> {
  const { data, error } = await db.from('cron_heartbeats').select('last_run_at').eq('kind', kind).maybeSingle()
  if (error) return { ok: false, detail: error.message }
  if (!data) return { ok: false, detail: `job "${kind}" nunca rodou` }

  const minutosDesdeUltimoRun = (agora.getTime() - new Date(data.last_run_at).getTime()) / 60_000
  return minutosDesdeUltimoRun <= LIMIAR_HEARTBEAT_MIN
    ? { ok: true }
    : { ok: false, detail: `job "${kind}" sem execução há ${Math.round(minutosDesdeUltimoRun)} min (limite ${LIMIAR_HEARTBEAT_MIN} min)` }
}
