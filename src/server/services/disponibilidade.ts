import { Temporal } from '@js-temporal/polyfill'

import { availableSlots, type IntervaloExpediente, type IntervaloOcupado } from '@/core/scheduling/available-slots'
import { weekdayPg } from '@/core/tempo/dia'
import { ouDoProfissionalOuGeral } from '@/server/db/filtro'
import { AppError } from '@/server/http/errors'
import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type SlotLivre = { startsAt: string; endsAt: string; professionalId: string }
export type ServicoParaSlots = { duration_min: number; parallel_capacity: number; buffer_before_min: number; buffer_after_min: number }

/**
 * APR-110a (docs/98 I-10): os horários livres de um dia, por profissional. Uma regra, um lugar: a
 * página pública (`disponibilidadePublica`, chave de serviço) e o "Marcar" do painel
 * (`disponibilidadeDoPainel`, cliente do usuário, RLS) chamam ESTA função; antes a conta vivia só
 * no público e o painel pedia data e hora num campo livre, sem saber o que estava ocupado.
 */
export async function slotsLivresDoDia(
  db: Cliente,
  entrada: {
    tenantId: string
    timezone: string
    settings: Parameters<typeof lerConfiguracoesAgenda>[0]
    servico: ServicoParaSlots
    profissionais: readonly { id: string }[]
    date: string
  },
): Promise<{ temExpediente: boolean; slots: SlotLivre[] }[]> {
  const { tenantId, timezone, servico, date } = entrada
  const dia = Temporal.PlainDate.from(date)
  const config = lerConfiguracoesAgenda(entrada.settings)
  const now = Temporal.Now.instant().toString()
  const inicioDia = dia.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fimDia = dia.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  return Promise.all(
    entrada.profissionais.map(async (prof) => {
      const [horarios, folgas, agendamentos] = await Promise.all([
        db
          .from('business_hours')
          .select('professional_id, weekday, opens_at, closes_at')
          .eq('tenant_id', tenantId)
          .eq('weekday', weekdayPg(dia))
          .or(ouDoProfissionalOuGeral('professional_id', prof.id)),
        db
          .from('time_off')
          .select('starts_at, ends_at')
          .eq('tenant_id', tenantId)
          .or(ouDoProfissionalOuGeral('professional_id', prof.id))
          .lt('starts_at', fimDia)
          .gt('ends_at', inicioDia),
        db
          .from('appointments')
          .select('starts_at, ends_at')
          .eq('tenant_id', tenantId)
          .eq('professional_id', prof.id)
          .in('status', ['pending', 'confirmed', 'arrived'])
          .lt('starts_at', fimDia)
          .gt('ends_at', inicioDia),
      ])
      if (horarios.error) throw new AppError('INTERNAL', { cause: horarios.error })
      if (folgas.error) throw new AppError('INTERNAL', { cause: folgas.error })
      if (agendamentos.error) throw new AppError('INTERNAL', { cause: agendamentos.error })
      const doProfissional = horarios.data.filter((h) => h.professional_id === prof.id)
      const doPadrao = horarios.data.filter((h) => h.professional_id === null)
      const businessHours: IntervaloExpediente[] = (doProfissional.length > 0 ? doProfissional : doPadrao).map((h) => ({
        opensAt: h.opens_at,
        closesAt: h.closes_at,
      }))
      if (businessHours.length === 0) return { temExpediente: false, slots: [] }
      const timeOff: IntervaloOcupado[] = (folgas.data ?? []).map((f) => ({ start: f.starts_at, end: f.ends_at }))
      const ocupados: IntervaloOcupado[] = (agendamentos.data ?? []).map((a) => ({ start: a.starts_at, end: a.ends_at }))
      const slots = availableSlots({
        date,
        timezone,
        businessHours,
        timeOff,
        appointments: ocupados,
        serviceDurationMin: servico.duration_min,
        bufferBeforeMin: servico.buffer_before_min,
        bufferAfterMin: servico.buffer_after_min,
        slotGranularityMin: config.slotGranularityMin,
        minLeadTimeMinutes: config.minLeadTimeMinutes,
        maxAdvanceDays: config.maxAdvanceDays,
        now,
        parallelCapacity: servico.parallel_capacity,
      })
      return {
        temExpediente: true,
        slots: slots.map((s) => ({
          startsAt: s,
          endsAt: Temporal.Instant.from(s).add({ minutes: servico.duration_min }).toString(),
          professionalId: prof.id,
        })),
      }
    }),
  )
}

/**
 * O "Marcar" do painel: a mesma conta do público, pelo cliente do usuário (RLS), sem os filtros
 * "online" (o balcão marca qualquer serviço ativo com qualquer profissional ativo). Sem
 * `professionalId`, agrega todos, como no público.
 */
export async function disponibilidadeDoPainel(
  db: Cliente,
  tenantId: string,
  entrada: { serviceId: string; date: string; professionalId?: string | null },
): Promise<SlotLivre[]> {
  let consultaProfissionais = db.from('professionals').select('id').eq('tenant_id', tenantId).eq('active', true).is('deleted_at', null)
  if (entrada.professionalId) consultaProfissionais = consultaProfissionais.eq('id', entrada.professionalId)
  const [tenant, servico, profissionais] = await Promise.all([
    db.from('tenants').select('timezone, settings').eq('id', tenantId).single(),
    db
      .from('services')
      .select('duration_min, parallel_capacity, buffer_before_min, buffer_after_min')
      .eq('id', entrada.serviceId)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .is('deleted_at', null)
      .maybeSingle(),
    consultaProfissionais,
  ])
  if (tenant.error) throw new AppError('INTERNAL', { cause: tenant.error })
  if (servico.error) throw new AppError('INTERNAL', { cause: servico.error })
  if (!servico.data) throw AppError.validacao({ serviceId: 'Esse serviço não está ativo.' })
  if (profissionais.error) throw new AppError('INTERNAL', { cause: profissionais.error })

  const porProfissional = await slotsLivresDoDia(db, {
    tenantId,
    timezone: tenant.data.timezone,
    settings: tenant.data.settings,
    servico: servico.data,
    profissionais: profissionais.data ?? [],
    date: entrada.date,
  })
  return porProfissional.flatMap((p) => p.slots).sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
}
