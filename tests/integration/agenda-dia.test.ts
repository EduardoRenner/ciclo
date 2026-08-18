import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarAgendamento, listarAgendaDoDia } from '@/server/services/agendamentos'
import { criarProfissional } from '@/server/services/profissionais'
import { definirExpediente } from '@/server/services/expediente'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de agenda do dia precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let userId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

function proximaTerca(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const DIA = proximaTerca()

function horario(hhmm: string): string {
  return `${DIA}T${hhmm}:00-03:00`
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `agenda-dia-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Agenda' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  usuarios.push(userId)

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão da Agenda do Dia',
    vertical: 'nails',
    slug: `agenda-dia-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure de Teste',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 3000,
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  // 09:00–13:00 = 240 minutos de expediente. Suficiente para caber os
  // agendamentos deste teste sem virar caçada por horário livre.
  await definirExpediente(svc, tenantId, {
    professionalId,
    blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '13:00' }],
  })
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('listarAgendaDoDia', () => {
  it(
    'traz nome de cliente e serviço via join, sem N+1',
    async () => {
      await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Cliente Com Nome', phone: '11987660001' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('09:00'),
          origin: 'app',
        },
        {},
      )

      const resumo = await listarAgendaDoDia(svc, tenantId, DIA, TZ, professionalId)
      const linha = resumo.appointments.find((a) => a.clients?.name === 'Cliente Com Nome')
      expect(linha).toBeDefined()
      expect(linha?.services?.name).toBe('Esmaltação de Teste')
      expect(linha?.professionals?.display_name).toBe('Manicure de Teste')
    },
    30_000,
  )

  it(
    'ocupação e previsto ignoram agendamento cancelado',
    async () => {
      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Vai Cancelar Antes', phone: '11987660002' },
          serviceId: servicoId,
          professionalId,
          startsAt: horario('09:30'),
          origin: 'app',
        },
        {},
      )

      const antes = await listarAgendaDoDia(svc, tenantId, DIA, TZ, professionalId)

      await svc.from('appointments').update({ status: 'canceled' }).eq('id', ag.id)

      const depois = await listarAgendaDoDia(svc, tenantId, DIA, TZ, professionalId)
      expect(depois.forecastCents).toBe(antes.forecastCents - 3000)
      expect(depois.occupancyRate).toBeLessThan(antes.occupancyRate)
    },
    30_000,
  )

  it(
    'ocupação é minutos ocupados sobre minutos de expediente do dia',
    async () => {
      // 09:00-13:00 = 240min de expediente. Um agendamento de 30min sozinho
      // no dia (sem os das outras `it`, que usam outro profissional) prova a
      // conta com um número exato.
      const outroProfissional = await criarProfissional(svc, tenantId, {
        displayName: 'Sozinha no Dia',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      await definirExpediente(svc, tenantId, {
        professionalId: outroProfissional.id,
        blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '13:00' }],
      })

      await criarAgendamento(
        svc,
        tenantId,
        TZ,
        userId,
        {
          clientDraft: { name: 'Única do Dia', phone: '11987660003' },
          serviceId: servicoId,
          professionalId: outroProfissional.id,
          startsAt: horario('10:00'),
          origin: 'app',
        },
        {},
      )

      const resumo = await listarAgendaDoDia(svc, tenantId, DIA, TZ, outroProfissional.id)
      expect(resumo.occupancyRate).toBeCloseTo(30 / 240, 4)
    },
    30_000,
  )

  it(
    'dia sem nenhum agendamento: ocupação 0, previsto 0, lista vazia',
    async () => {
      const outroDia = new Date(DIA)
      outroDia.setUTCDate(outroDia.getUTCDate() + 7) // próxima terça — mesmo weekday, sem agendamento nenhum
      const resumo = await listarAgendaDoDia(svc, tenantId, outroDia.toISOString().slice(0, 10), TZ, professionalId)
      expect(resumo).toMatchObject({ appointments: [], occupancyRate: 0, forecastCents: 0 })
    },
    30_000,
  )

  it(
    'carrega 60 agendamentos em menos de 200ms',
    async () => {
      const profissionalCheio = await criarProfissional(svc, tenantId, {
        displayName: 'Agenda Cheia',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })
      // 09:00 a 09:00+60×15min = expediente comprido o bastante para 60 encaixes de 15min.
      await definirExpediente(svc, tenantId, {
        professionalId: profissionalCheio.id,
        blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '23:00' }],
      })

      const clientesDoLote = await Promise.all(
        Array.from({ length: 60 }, (_, i) =>
          svc
            .from('clients')
            .insert({ tenant_id: tenantId, name: `Lote ${i}`, phone_e164: null })
            .select('id')
            .single(),
        ),
      )

      const inserts = clientesDoLote.map((c, i) => {
        const minutos = i * 15
        const h = String(9 + Math.floor(minutos / 60)).padStart(2, '0')
        const m = String(minutos % 60).padStart(2, '0')
        return {
          tenant_id: tenantId,
          client_id: c.data!.id,
          professional_id: profissionalCheio.id,
          service_id: servicoId,
          starts_at: horario(`${h}:${m}`),
          ends_at: new Date(new Date(horario(`${h}:${m}`)).getTime() + 15 * 60_000).toISOString(),
          status: 'confirmed' as const,
          price_cents: 3000,
        }
      })
      const inserido = await svc.from('appointments').insert(inserts)
      expect(inserido.error).toBeNull()

      const inicio = Date.now()
      const resumo = await listarAgendaDoDia(svc, tenantId, DIA, TZ, profissionalCheio.id)
      const duracao = Date.now() - inicio

      expect(resumo.appointments.length).toBeGreaterThanOrEqual(60)
      expect(duracao).toBeLessThan(200)
    },
    30_000,
  )
})
