import { Temporal } from '@js-temporal/polyfill'
import { cache } from 'react'
import { z } from 'zod'

import { availableSlots, type IntervaloExpediente, type IntervaloOcupado } from '@/core/scheduling/available-slots'
import { withNovoTenant } from '@/server/db/with-tenant'
import { listarExpediente } from '@/server/services/expediente'
import { lerConfiguracoesAgenda } from '@/server/services/configuracoes-agenda'
import { lerSite } from '@/server/services/site'
import { normalizarTelefoneBR } from '@/server/services/telefone'
import { criarAgendamento } from '@/server/services/agendamentos'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

const ACENTO_PADRAO = { acc: '#a855f7', acc2: '#c084fc' }

/**
 * Toda leitura pública passa por `withNovoTenant` (service_role): a RLS de
 * `tenants`/`services`/`professionals` exige `has_tenant()`, que um visitante
 * anônimo nunca tem — não existe outro caminho. A disciplina fica em nunca
 * selecionar coluna a mais (regra do TICKET-027: "nunca expor clientId,
 * telefone de outra pessoa ou lista de clientes"). `settings` sai da consulta
 * mas nunca do retorno público — carrega `min_lead_time_minutes` etc., que
 * ninguém de fora precisa ver; só `lerSite()` (whitelist) chega no visitante.
 */
async function tenantPeloSlug(svc: Cliente, slug: string) {
  const { data, error } = await svc
    .from('tenants')
    .select('id, name, slug, vertical, timezone, phone, address, settings')
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
  /** Fuso do salão — a página pública precisa dizer "hoje" no horário de quem atende, não no do servidor. */
  timezone: string
  phone: string | null
  address: string | null
  tagline: string | null
  about: string | null
  whatsapp: string | null
  instagram: string | null
  accentColor: { acc: string; acc2: string }
  hours: { weekday: number; opensAt: string; closesAt: string }[]
  services: { id: string; name: string; description: string | null; durationMin: number; priceCents: number }[]
  professionals: { id: string; displayName: string }[]
}

/**
 * `cache()` do React: `layout.tsx` (cor de acento), `page.tsx` (a landing) e
 * `generateMetadata` chamam esta função na mesma requisição — sem isso seriam
 * 3 idas ao banco por visita em vez de 1.
 */
export const perfilPublico = cache(async (slug: string): Promise<PerfilPublico> => {
  return withNovoTenant(async (svc) => {
    const tenant = await tenantPeloSlug(svc, slug)

    const [servicos, profissionais, pack, horarioPadrao] = await Promise.all([
      svc
        .from('services')
        .select('id, name, description, duration_min, price_cents')
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
      svc.from('vertical_packs').select('accent_color').eq('vertical', tenant.vertical).maybeSingle(),
      listarExpediente(svc, tenant.id, null),
    ])
    if (servicos.error) throw new AppError('INTERNAL', { cause: servicos.error })
    if (profissionais.error) throw new AppError('INTERNAL', { cause: profissionais.error })
    if (pack.error) throw new AppError('INTERNAL', { cause: pack.error })

    const site = lerSite(tenant.settings)
    const acc = pack.data?.accent_color ?? ACENTO_PADRAO.acc

    return {
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.timezone,
      phone: tenant.phone,
      address: typeof tenant.address === 'string' ? tenant.address : null,
      tagline: site.tagline ?? null,
      about: site.about ?? null,
      whatsapp: site.whatsapp ?? null,
      instagram: site.instagram ?? null,
      accentColor: { acc, acc2: ACENTO_PADRAO.acc2 === acc ? acc : misturarComBranco(acc, 0.3) },
      hours: horarioPadrao.map((h) => ({ weekday: h.weekday, opensAt: h.opens_at, closesAt: h.closes_at })),
      services: (servicos.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.duration_min,
        priceCents: s.price_cents,
      })),
      professionals: (profissionais.data ?? []).map((p) => ({ id: p.id, displayName: p.display_name })),
    }
  })
})

/**
 * `color-mix()` fica pro CSS no cliente (Fase 3 do plano) — aqui é só um
 * clareamento simples em JS pra ter um `acc2` plausível quando o pack não
 * define os dois tons (hoje `vertical_packs` só tem uma coluna de cor).
 */
function misturarComBranco(hex: string, fator: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return hex
  const canal = (h: string) => Math.round(parseInt(h, 16) + (255 - parseInt(h, 16)) * fator)
  const hex2 = (n: number) => n.toString(16).padStart(2, '0')
  return `#${hex2(canal(m[1]!))}${hex2(canal(m[2]!))}${hex2(canal(m[3]!))}`
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
      .select('duration_min, parallel_capacity, buffer_before_min, buffer_after_min')
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
        // Achado na auditoria pré-`/admin`: vinha fixo em 0, ignorando o que o
        // serviço cadastra — o buffer só funcionava no agendamento interno, nunca
        // no site público. Agora que o formulário de serviço expõe os dois campos
        // (Fase 2), o dono vai configurar e esperar que valha aqui também.
        bufferBeforeMin: servico.buffer_before_min,
        bufferAfterMin: servico.buffer_after_min,
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
