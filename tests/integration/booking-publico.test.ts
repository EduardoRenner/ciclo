import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { definirExpediente } from '@/server/services/expediente'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarAgendamentoPublico, disponibilidadePublica, perfilPublico } from '@/server/services/public-booking'

import { POST as reservar } from '@/app/api/v1/public/[slug]/book/route'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de booking público precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let slug: string
let professionalId: string
let servicoOnlineId: string
let servicoOfflineId: string
const tenants: string[] = []
const usuarios: string[] = []

function proximaTerca(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
const DIA = proximaTerca()

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `booking-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Booking' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  slug = `booking-${marca}`
  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão Público de Teste',
    vertical: 'brows',
    slug,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)
  await svc.from('tenants').update({ phone: '+5511900000000' }).eq('id', tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Designer de Sobrancelha',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const online = await criarServico(svc, tenantId, {
    name: 'Design Online',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 6000,
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoOnlineId = online.id

  const offline = await criarServico(svc, tenantId, {
    name: 'Só Presencial',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 6000,
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: false,
    categoryId: null,
  })
  servicoOfflineId = offline.id

  await definirExpediente(svc, tenantId, {
    professionalId,
    blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '18:00' }],
  })
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

function corpoBooking(hhmm: string, telefone: string, extra: Record<string, unknown> = {}) {
  return {
    serviceId: servicoOnlineId,
    professionalId,
    startsAt: `${DIA}T${hhmm}:00-03:00`,
    name: 'Cliente Pública',
    phone: telefone,
    ...extra,
  }
}

function req(corpo: unknown, ip = '203.0.113.1'): Request {
  return new Request(`https://interno/api/v1/public/${slug}/book`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(corpo),
  })
}

function ctx() {
  return { params: Promise.resolve({ slug }) }
}

describe('perfilPublico', () => {
  it(
    'só mostra serviço com bookable_online e profissional com accepts_online',
    async () => {
      const perfil = await perfilPublico(slug)
      expect(perfil.services.map((s) => s.id)).toContain(servicoOnlineId)
      expect(perfil.services.map((s) => s.id)).not.toContain(servicoOfflineId)
      expect(perfil.professionals.map((p) => p.id)).toContain(professionalId)
    },
    30_000,
  )

  it('não devolve campo interno nenhum (settings, document, address)', async () => {
    const perfil = await perfilPublico(slug)
    expect(perfil).not.toHaveProperty('settings')
    expect(perfil).not.toHaveProperty('document')
    expect(perfil).not.toHaveProperty('address')
  })

  it('slug que não existe devolve NOT_FOUND, não vaza detalhe', async () => {
    const erro = await perfilPublico(`nao-existe-${randomUUID()}`).catch((e: unknown) => e)
    expect(erro).toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('disponibilidadePublica', () => {
  it(
    'devolve slots reais, com professionalId em cada um',
    async () => {
      // Sem `professionalId`, agrega todo mundo que aceita online — e o
      // dono também entra nessa lista (o onboarding cria um profissional
      // para ele, com o expediente padrão que o pack de vertical semeia).
      // Passar o profissional explicitamente aqui é o que isola o caso.
      const slots = await disponibilidadePublica(slug, servicoOnlineId, DIA, professionalId)
      expect(slots.length).toBeGreaterThan(0)
      expect(slots.every((s) => s.professionalId === professionalId)).toBe(true)
    },
    30_000,
  )

  it(
    'sem professionalId, agrega o dono (criado no onboarding) e o profissional explícito',
    async () => {
      const slots = await disponibilidadePublica(slug, servicoOnlineId, DIA)
      const profissionaisNosSlots = new Set(slots.map((s) => s.professionalId))
      expect(profissionaisNosSlots.size).toBeGreaterThanOrEqual(2)
      expect(profissionaisNosSlots.has(professionalId)).toBe(true)
    },
    30_000,
  )
})

describe('criarAgendamentoPublico', () => {
  it(
    'cria o agendamento com origin public_page',
    async () => {
      const resultado = await criarAgendamentoPublico(slug, {
        serviceId: servicoOnlineId,
        professionalId,
        startsAt: `${DIA}T09:00:00-03:00`,
        name: 'Ana Pública',
        phone: '11988110001',
      })
      const linha = await svc.from('appointments').select('origin, created_by').eq('id', resultado.appointmentId).single()
      expect(linha.data).toMatchObject({ origin: 'public_page', created_by: null })
    },
    30_000,
  )
})

describe('POST /api/v1/public/:slug/book — a rota inteira', () => {
  it(
    'honeypot preenchido: responde como sucesso, mas não cria nada',
    async () => {
      const antes = await svc.from('appointments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)

      const r = await reservar(req(corpoBooking('10:00', '11988110002', { website: 'http://spam.test' }), '203.0.113.9'), ctx())
      expect(r.status).toBe(200)

      const depois = await svc.from('appointments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      expect(depois.count).toBe(antes.count)
    },
    30_000,
  )

  it(
    'DDD inexistente é recusado com VALIDATION_ERROR',
    async () => {
      const r = await reservar(req(corpoBooking('10:30', '10988110003'), '203.0.113.10'), ctx())
      expect(r.status).toBe(422)
      const json = (await r.json()) as { error: { code: string } }
      expect(json.error.code).toBe('VALIDATION_ERROR')
    },
    30_000,
  )

  it(
    'resposta idêntica para telefone novo e telefone que já existe',
    async () => {
      const telefone = '11988110004'
      const r1 = await reservar(req(corpoBooking('11:00', telefone), '203.0.113.11'), ctx())
      const json1 = (await r1.json()) as { data: { appointmentId: string } }

      const r2 = await reservar(req(corpoBooking('11:30', telefone), '203.0.113.12'), ctx())
      const json2 = (await r2.json()) as { data: { appointmentId: string } }

      expect(r1.status).toBe(200)
      expect(r2.status).toBe(200)
      expect(Object.keys(json1.data)).toEqual(Object.keys(json2.data))
    },
    30_000,
  )

  it(
    'script tentando 50 agendamentos do mesmo IP: bloqueado depois do limite',
    async () => {
      const ip = '203.0.113.50'
      const respostas: number[] = []
      for (let i = 0; i < 50; i++) {
        const r = await reservar(req(corpoBooking('12:00', `1198822${String(i).padStart(4, '0')}`), ip), ctx())
        respostas.push(r.status)
      }

      // Limite é 5/min por IP — bem menos que 50 tentativas passam.
      const sucesso = respostas.filter((s) => s === 200 || s === 409) // 409 = colidiu no mesmo slot, mas passou do rate limit
      const bloqueado = respostas.filter((s) => s === 429)
      expect(bloqueado.length).toBeGreaterThan(0)
      expect(sucesso.length).toBeLessThan(50)
    },
    60_000,
  )

  it(
    'conflito de horário no público também devolve alternativas',
    async () => {
      const primeiro = await reservar(req(corpoBooking('14:00', '11988110099'), '203.0.113.20'), ctx())
      expect(primeiro.status).toBe(200)

      const segundo = await reservar(req(corpoBooking('14:00', '11988110098'), '203.0.113.21'), ctx())
      expect(segundo.status).toBe(409)
      const json = (await segundo.json()) as { error: { code: string; details?: { alternatives?: string[] } } }
      expect(json.error.code).toBe('SLOT_TAKEN')
      expect(json.error.details?.alternatives?.length).toBeGreaterThan(0)
    },
    30_000,
  )
})
