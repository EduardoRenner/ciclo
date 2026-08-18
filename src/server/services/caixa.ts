import { Temporal } from '@js-temporal/polyfill'

import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ResumoCaixa = {
  ticketsCount: number
  revenueCents: number
  materialCents: number
  feeCents: number
  commissionCents: number
  /** §5, "Sobrou" = receita − material − taxa − comissão. */
  profitCents: number
}

const TAMANHO_PAGINA = 1000

/**
 * TICKET-047. Soma direto de `tickets`, não da view `v_daily_cash` (0001):
 * a view agrupa por `date_trunc('day', closed_at)`, que trunca no fuso da
 * SESSÃO do Postgres — UTC por padrão via PostgREST, não o fuso do tenant.
 * Um fechamento às 23h de Brasília (02h UTC do dia seguinte) cairia no dia
 * errado. Buscar as linhas cruas e somar em memória, com o limite calculado
 * em `Temporal` no fuso do tenant (mesmo padrão do TICKET-022/025), evita o
 * bug em vez de herdá-lo. Registrado em `docs/DECISOES.md`.
 */
async function somarTickets(db: Cliente, tenantId: string, inicio: string, fim: string): Promise<ResumoCaixa> {
  const resumo: ResumoCaixa = { ticketsCount: 0, revenueCents: 0, materialCents: 0, feeCents: 0, commissionCents: 0, profitCents: 0 }

  for (let pagina = 0; ; pagina++) {
    const de = pagina * TAMANHO_PAGINA
    const { data, error } = await db
      .from('tickets')
      .select('total_cents, material_cost_cents, fee_cents, commission_cents, profit_cents')
      .eq('tenant_id', tenantId)
      .in('status', ['closed', 'paid'])
      .gte('closed_at', inicio)
      .lt('closed_at', fim)
      .order('id')
      .range(de, de + TAMANHO_PAGINA - 1)
    if (error) throw new AppError('INTERNAL', { cause: error })

    for (const t of data ?? []) {
      resumo.ticketsCount++
      resumo.revenueCents += t.total_cents
      resumo.materialCents += t.material_cost_cents
      resumo.feeCents += t.fee_cents
      resumo.commissionCents += t.commission_cents
      resumo.profitCents += t.profit_cents
    }

    if (!data || data.length < TAMANHO_PAGINA) break
  }

  return resumo
}

/** `GET /cash/daily?date=`. */
export async function fechamentoDiario(db: Cliente, tenantId: string, timezone: string, date: string): Promise<ResumoCaixa & { date: string }> {
  const dia = Temporal.PlainDate.from(date)
  const inicio = dia.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fim = dia.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const resumo = await somarTickets(db, tenantId, inicio, fim)
  return { date, ...resumo }
}

/** `GET /cash/summary?month=` — `month` no formato `YYYY-MM`. */
export async function resumoMensal(db: Cliente, tenantId: string, timezone: string, month: string): Promise<ResumoCaixa & { month: string }> {
  const [ano, mes] = month.split('-').map(Number)
  if (!ano || !mes) throw AppError.validacao({ month: 'Use o formato AAAA-MM.' })

  const anoMes = Temporal.PlainYearMonth.from({ year: ano, month: mes })
  const inicio = anoMes.toPlainDate({ day: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fim = anoMes
    .toPlainDate({ day: 1 })
    .add({ months: 1 })
    .toZonedDateTime({ timeZone: timezone, plainTime: '00:00' })
    .toInstant()
    .toString()

  const resumo = await somarTickets(db, tenantId, inicio, fim)
  return { month, ...resumo }
}
