import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { availableSlots, type IntervaloExpediente, type IntervaloOcupado } from '@/core/scheduling/available-slots'
import { withNovoTenant } from '@/server/db/with-tenant'
import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'
import { normalizarTelefoneBR } from '@/server/services/telefone'
import { criarAgendamento } from '@/server/services/agendamentos'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Toda leitura pública passa por `withNovoTenant` (service_role): a RLS de
 * `tenants`/`services`/`professionals` exige `has_tenant()`, que um visitante
 * anônimo nunca tem — não existe outro caminho. A disciplina fica em nunca
 * selecionar coluna a mais (regra do TICKET-027: "nunca expor clientId,
 * telefone de outra pessoa ou lista de clientes").
 */
async function tenantPeloSlug(svc: Cliente, slug: string) {
  const { data, error } = await svc
    .from('tenants')
    .select('id, name, slug, vertical, timezone, phone, settings')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Esse endereço não existe.' })
  return data
}

export type PerfilPublico = {
  name: string
  slug: string
  phone: string | null
  services: { id: string; name: string; durationMin: number; priceCents: number }[]
  professionals: { id: string; displayName: string }[]
}

export async function perfilPublico(slug: string): Promise<PerfilPublico> {
  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    const [servicos, profissionais] = await Promise.all([
      svc
        .from('services')
        .select('id, name, duration_min, price_cents')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .eq('bookable_online', true)
        .is('deleted_at', null)
        .order('position'),
      svc
        .from('professionals')
        .select('id, display_name')
        .eq('tenant_id', tenant.id)
        .eq('active', true)
        .eq('accepts_online', true)
        .is('deleted_at', null)
        .order('display_name'),
    ])
    if (servicos.error) throw new AppError('INTERNAL', { cause: servicos.error })
    if (profissionais.error) throw new AppError('INTERNAL', { cause: profissionais.error })

    return {
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone,
      services: (servicos.data ?? []).map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min, priceCents: s.price_cents })),
      professionals: (profissionais.data ?? []).map((p) => ({ id: p.id, displayName: p.display_name })),
    }
  })
}

function weekdayPg(dia: Temporal.PlainDate): number {
  return dia.dayOfWeek % 7
}

export type SlotPublico = { startsAt: string; endsAt: string; professionalId: string }

/**
 * `GET .../availability`: um dia só, e se `professionalId` não vier, agrega
 * a disponibilidade de todos os profissionais que aceitam o serviço online —
 * é o "profissional? " opcional do corpo do `book` (FAQ E71-adjacente: a
 * cliente pode não ter preferência).
 */
export async function disponibilidadePublica(
  slug: string,
  serviceId: string,
  date: string,
  professionalId?: string,
): Promise<SlotPublico[]> {
  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    const { data: servico, error: erroServico } = await svc
      .from('services')
      .select('duration_min, parallel_capacity')
      .eq('id', serviceId)
      .eq('tenant_id', tenant.id)
      .eq('active', true)
      .eq('bookable_online', true)
      .is('deleted_at', null)
      .maybeSingle()
    if (erroServico) throw new AppError('INTERNAL', { cause: erroServico })
    if (!servico) throw AppError.validacao({ serviceId: 'Esse serviço não está disponível para agendar online.' })

    let consultaProfissionais = svc
      .from('professionals')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('active', true)
      .eq('accepts_online', true)
      .is('deleted_at', null)
    if (professionalId) consultaProfissionais = consultaProfissionais.eq('id', professionalId)
    const { data: profissionais, error: erroProf } = await consultaProfissionais
    if (erroProf) throw new AppError('INTERNAL', { cause: erroProf })

    const dia = Temporal.PlainDate.from(date)
    const config = lerConfiguracoesAgenda(tenant.settings)
    // FAQ E62: booking público nunca fura a antecedência mínima — diferente
    // do app do profissional, que pode fazer encaixe manual.
    const now = Temporal.Now.instant().toString()

    const inicioDia = dia.toZonedDateTime({ timeZone: tenant.timezone, plainTime: '00:00' }).toInstant().toString()
    const fimDia = dia.add({ days: 1 }).toZonedDateTime({ timeZone: tenant.timezone, plainTime: '00:00' }).toInstant().toString()

    const resultado: SlotPublico[] = []

    for (const prof of profissionais ?? []) {
      const [horarios, folgas, agendamentos] = await Promise.all([
        svc
          .from('business_hours')
          .select('professional_id, weekday, opens_at, closes_at')
          .eq('tenant_id', tenant.id)
          .eq('weekday', weekdayPg(dia))
          .or(`professional_id.eq.${prof.id},professional_id.is.null`),
        svc
          .from('time_off')
          .select('starts_at, ends_at')
          .eq('tenant_id', tenant.id)
          .or(`professional_id.eq.${prof.id},professional_id.is.null`)
          .lt('starts_at', fimDia)
          .gt('ends_at', inicioDia),
        svc
          .from('appointments')
          .select('starts_at, ends_at')
          .eq('tenant_id', tenant.id)
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
      if (businessHours.length === 0) continue

      const timeOff: IntervaloOcupado[] = (folgas.data ?? []).map((f) => ({ start: f.starts_at, end: f.ends_at }))
      const ocupados: IntervaloOcupado[] = (agendamentos.data ?? []).map((a) => ({ start: a.starts_at, end: a.ends_at }))

      const slots = availableSlots({
        date,
        timezone: tenant.timezone,
        businessHours,
        timeOff,
        appointments: ocupados,
        serviceDurationMin: servico.duration_min,
        bufferBeforeMin: 0,
        bufferAfterMin: 0,
        slotGranularityMin: config.slotGranularityMin,
        minLeadTimeMinutes: config.minLeadTimeMinutes,
        maxAdvanceDays: config.maxAdvanceDays,
        now,
        parallelCapacity: servico.parallel_capacity,
      })

      for (const s of slots) {
        resultado.push({
          startsAt: s,
          endsAt: Temporal.Instant.from(s).add({ minutes: servico.duration_min }).toString(),
          professionalId: prof.id,
        })
      }
    }

    return resultado.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
  })
}

export const EsquemaBookingPublico = z.object({
  serviceId: z.uuid('Escolha um serviço.'),
  professionalId: z.uuid().nullish(),
  startsAt: z.iso.datetime({ message: 'Horário inválido.', offset: true }),
  name: z.string().trim().min(2, 'Digite seu nome.'),
  phone: z.string().trim().min(1, 'Digite seu telefone.'),
  captchaToken: z.string().nullish(),
  // Honeypot (G100/TICKET-027): campo que só um robô preenche. Sem limite de
  // tamanho aqui de propósito — um `max(0)` faria o Zod recusar a requisição
  // com VALIDATION_ERROR antes de a rota decidir o que fazer, e aí a resposta
  // já entregaria "notei o honeypot" para quem está tentando burlar. A
  // decisão de responder como sucesso sem criar nada é da rota, não do schema.
  website: z.string().nullish(),
})

/**
 * `POST .../book`. Reaproveita `criarAgendamento()` inteiro — mesma exclusion
 * constraint, mesmo `SLOT_TAKEN` com alternativas, mesma reutilização de
 * cliente por telefone (o que já entrega "resposta idêntica para telefone
 * novo e existente" do TICKET-027: o retorno de sucesso é o mesmo dos dois
 * jeitos, porque `resolverCliente` não diferencia por fora).
 */
export async function criarAgendamentoPublico(slug: string, entrada: z.infer<typeof EsquemaBookingPublico>) {
  const telefone = normalizarTelefoneBR(entrada.phone)
  if (!telefone) throw AppError.validacao({ phone: 'Telefone inválido. Confira o DDD e o número.' })

  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    let professionalId = entrada.professionalId ?? undefined
    if (!professionalId) {
      const disponiveis = await disponibilidadePublica(slug, entrada.serviceId, entrada.startsAt.slice(0, 10))
      const achado = disponiveis.find((s) => s.startsAt === entrada.startsAt)
      if (!achado) {
        throw new AppError('SLOT_TAKEN', { details: { alternatives: disponiveis.slice(0, 3).map((s) => s.startsAt) } })
      }
      professionalId = achado.professionalId
    }

    const agendamento = await criarAgendamento(
      svc,
      tenant.id,
      tenant.timezone,
      null,
      {
        clientDraft: { name: entrada.name, phone: telefone },
        serviceId: entrada.serviceId,
        professionalId,
        startsAt: entrada.startsAt,
        origin: 'public_page',
        note: null,
      },
      tenant.settings,
    )

    return { appointmentId: agendamento.id }
  })
}
