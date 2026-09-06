import { Temporal } from '@js-temporal/polyfill'

import { diaMaisOcioso, type DiaOcioso, type Weekday } from '@/core/agenda/ociosidade'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/** Mesma convenção de `agendamentos.ts`: Postgres `weekday` 0 = domingo … `Temporal.dayOfWeek` 1 = segunda … 7 = domingo. */
function weekdayPg(dia: Temporal.PlainDate): Weekday {
  return (dia.dayOfWeek % 7) as Weekday
}

/** Status que significam "a cadeira teve gente" num dia já encerrado — mesmo conjunto de `CONTAM_COMO_RECEITA` em `agendamentos.ts`. */
const OCUPOU_A_CADEIRA = new Set(['pending', 'confirmed', 'arrived', 'done'])

/**
 * Semanas de histórico examinadas por dia da semana. Acima do `MINIMO_DE_SEMANAS_OBSERVADAS`
 * (`core/agenda/ociosidade.ts`) para dar margem: um salão com exatamente 4 semanas de uso não fica
 * refém de uma única semana ruim para qualificar.
 */
const JANELA_DE_SEMANAS = 8

/**
 * `docs/53` D-01. Duas idas: `business_hours` (só para saber quais dias o salão abre — sem
 * expediente cadastrado para um dia, ele nunca entra na conta, porque "vazio" e "fechado" são
 * fatos diferentes, mesma distinção que `listarAgendaDoDia` já faz) e `appointments` da janela.
 * A conta em si — decidir qual dia é o pior, e se algum qualifica — é toda em `diaMaisOcioso`, pura.
 */
export async function diaMaisOciosoDoTenant(db: Cliente, tenantId: string, timezone: string, hoje: string): Promise<DiaOcioso | null> {
  const hojeDate = Temporal.PlainDate.from(hoje)

  const [{ data: horarios, error: erroHorarios }, { data: appointments, error: erroAg }] = await Promise.all([
    db.from('business_hours').select('weekday').eq('tenant_id', tenantId).is('professional_id', null),
    (() => {
      const inicio = hojeDate.subtract({ weeks: JANELA_DE_SEMANAS }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
      const fim = hojeDate.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
      return db.from('appointments').select('starts_at, status').eq('tenant_id', tenantId).gte('starts_at', inicio).lt('starts_at', fim)
    })(),
  ])
  if (erroHorarios) throw new AppError('INTERNAL', { cause: erroHorarios })
  if (erroAg) throw new AppError('INTERNAL', { cause: erroAg })

  const diasAbertos = new Set<Weekday>((horarios ?? []).map((h) => h.weekday as Weekday))
  if (diasAbertos.size === 0) return null

  // Data (no fuso do salão) de cada agendamento que ocupou a cadeira de verdade — um Set de
  // "YYYY-MM-DD" é o suficiente para responder "este dia teve gente", sem guardar hora nenhuma.
  const datasOcupadas = new Set(
    (appointments ?? [])
      .filter((a) => OCUPOU_A_CADEIRA.has(a.status))
      .map((a) => Temporal.Instant.from(a.starts_at).toZonedDateTimeISO(timezone).toPlainDate().toString()),
  )

  const porWeekday = new Map<Weekday, boolean[]>()
  for (const weekday of diasAbertos) {
    const ocorrencias: boolean[] = []
    // A ocorrência mais recente DAQUELE weekday que já terminou — nunca hoje, que ainda não acabou.
    let cursor = hojeDate.subtract({ days: 1 })
    while (weekdayPg(cursor) !== weekday) cursor = cursor.subtract({ days: 1 })

    for (let i = 0; i < JANELA_DE_SEMANAS; i++) {
      ocorrencias.push(datasOcupadas.has(cursor.toString()))
      cursor = cursor.subtract({ days: 7 })
    }
    porWeekday.set(weekday, ocorrencias)
  }

  return diaMaisOcioso(porWeekday)
}
