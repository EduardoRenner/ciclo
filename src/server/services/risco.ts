import { Temporal } from '@js-temporal/polyfill'

import { computeNoShowScore, type EntradaScoreRisco, type ResultadoScoreRisco } from '@/core/risk/no-show-score'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * TICKET-041. Reúne o histórico de I/O que `computeNoShowScore` (puro, §5.4)
 * precisa. Calculado **na criação** do agendamento — antes de existir
 * confirmação, então `confirmouAte12hAntes` nasce sempre `false` aqui; é uma
 * simplificação registrada em `docs/DECISOES.md`, não um bug: o valor grava a
 * "foto" do risco no momento da marcação, que é quando o booking público
 * precisa decidir se exige sinal (`LIMIAR_SINAL_OBRIGATORIO`).
 *
 * `pagouSinal` e `assinanteDoClube` ficam sempre `false`: cobrança de sinal
 * (TICKET-032) e clube de assinatura (fora do MVP, `00-BRIEFING §3`) não
 * existem ainda. Quando TICKET-032 nascer, passa a alimentar aqui.
 */
export async function calcularScoreDeRisco(
  db: Cliente,
  tenantId: string,
  timezone: string,
  entrada: { clientId: string; startsAt: string; agora?: string },
): Promise<ResultadoScoreRisco> {
  const { count: faltasAnteriores, error: erroFaltas } = await db
    .from('appointments')
    .select('id', { head: true, count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', entrada.clientId)
    .eq('status', 'no_show')
  if (erroFaltas) throw new AppError('INTERNAL', { cause: erroFaltas })

  const { count: atendimentosConcluidos, error: erroConcluidos } = await db
    .from('appointments')
    .select('id', { head: true, count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', entrada.clientId)
    .eq('status', 'done')
  if (erroConcluidos) throw new AppError('INTERNAL', { cause: erroConcluidos })

  const primeiraVisita = (faltasAnteriores ?? 0) === 0 && (atendimentosConcluidos ?? 0) === 0

  const agora = Temporal.Instant.from(entrada.agora ?? Temporal.Now.instant().toString())
  const startsAt = Temporal.Instant.from(entrada.startsAt)
  const antecedenciaDias = agora.until(startsAt).total('days')

  const inicioLocal = startsAt.toZonedDateTimeISO(timezone)

  const features: EntradaScoreRisco = {
    faltasAnteriores: faltasAnteriores ?? 0,
    primeiraVisita,
    antecedenciaDias,
    confirmouAte12hAntes: false,
    horaLocal: inicioLocal.hour,
    // Postgres/ISO: sábado é o dia 6 (dayOfWeek 6, domingo é 7).
    sabado: inicioLocal.dayOfWeek === 6,
    pagouSinal: false,
    assinanteDoClube: false,
    // "sem falta" de verdade: só conta se este cliente nunca faltou.
    atendimentosSemFalta: (faltasAnteriores ?? 0) === 0 ? (atendimentosConcluidos ?? 0) : 0,
  }

  return computeNoShowScore(features)
}
