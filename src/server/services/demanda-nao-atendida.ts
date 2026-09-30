import { Temporal } from '@js-temporal/polyfill'

import type { Weekday } from '@/core/agenda/ociosidade'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Quantas procuras caíram em DIA FECHADO nos últimos `dias`, por dia da semana (docs/84 §2.2).
 *
 * Conta PARES DISTINTOS (serviço, dia procurado), não linhas: sem dado pessoal não há como saber se
 * três eventos de domingo são três pessoas ou uma espiando três vezes. O par distinto é o piso
 * honesto — pode subcontar gente, nunca inflar. É o número que o mapa de vazamento mostra como fato.
 */
export async function procurasEmDiaFechado(db: Cliente, tenantId: string, hoje: string, dias = 30): Promise<{ weekday: Weekday; procuras: number }[]> {
  const desde = Temporal.PlainDate.from(hoje).subtract({ days: dias }).toString()
  const { data, error } = await db
    .from('product_events')
    .select('meta')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'demanda_nao_atendida')
    .gte('created_at', desde)
    .limit(5_000)
  if (error) throw new AppError('INTERNAL', { cause: error })

  const pares = new Map<Weekday, Set<string>>()
  for (const { meta } of data ?? []) {
    const m = meta as Record<string, unknown> | null
    if (!m || m.motivo !== 'dia_fechado' || typeof m.diaDaSemana !== 'number' || typeof m.dia !== 'string') continue
    const w = m.diaDaSemana as Weekday
    if (!pares.has(w)) pares.set(w, new Set())
    pares.get(w)!.add(`${String(m.servicoId)}|${m.dia}`)
  }
  return [...pares.entries()].map(([weekday, s]) => ({ weekday, procuras: s.size }))
}
