import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarAgendamento } from '@/server/services/agendamentos'
import { criarProfissional } from '@/server/services/profissionais'
import { definirExpediente } from '@/server/services/expediente'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarServico } from '@/server/services/servicos'
import { calcularScoreDeRisco } from '@/server/services/risco'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de risco precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
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

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `risco-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Risco' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Risco',
    vertical: 'barber',
    slug: `risco-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Barbeiro do Risco',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Corte do Risco',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 5000,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  await definirExpediente(svc, tenantId, {
    professionalId,
    blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '22:00' }],
  })
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('calcularScoreDeRisco', () => {
  it(
    'cliente sem histórico: primeira visita soma 0,15 sobre a base',
    async () => {
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Estreante do Risco' }).select('id').single()

      const r = await calcularScoreDeRisco(svc, tenantId, TZ, {
        clientId: cliente.data!.id,
        startsAt: `${DIA}T10:00:00-03:00`,
        agora: `${DIA}T09:00:00-03:00`,
      })
      // base 0,10 + primeira visita 0,15 + não confirmou 0,10 (sempre falso na criação)
      expect(r.score).toBeCloseTo(0.35, 5)
      expect(r.features.primeiraVisita).toBe(true)
    },
    30_000,
  )

  it(
    'cliente com 2 faltas anteriores conta faltasAnteriores corretamente',
    async () => {
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Faltosa do Risco' }).select('id').single()
      const clientId = cliente.data!.id

      for (let i = 0; i < 2; i++) {
        await svc.from('appointments').insert({
          tenant_id: tenantId,
          client_id: clientId,
          professional_id: professionalId,
          service_id: servicoId,
          starts_at: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
          ends_at: new Date(Date.now() - (i + 1) * 86_400_000 + 3_600_000).toISOString(),
          status: 'no_show',
          price_cents: 5000,
        })
      }

      const r = await calcularScoreDeRisco(svc, tenantId, TZ, {
        clientId,
        startsAt: `${DIA}T10:00:00-03:00`,
        agora: `${DIA}T09:00:00-03:00`,
      })
      expect(r.features.faltasAnteriores).toBe(2)
      expect(r.features.primeiraVisita).toBe(false)
    },
    30_000,
  )
})

describe('criarAgendamento — score de risco', () => {
  it(
    'grava no_show_score e risk_features na criação',
    async () => {
      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        null,
        {
          clientDraft: { name: 'Cliente do Score', phone: '11987651234' },
          serviceId: servicoId,
          professionalId,
          startsAt: `${DIA}T11:00:00-03:00`,
          origin: 'app',
        },
        {},
      )

      const linha = await svc.from('appointments').select('no_show_score, risk_features').eq('id', ag.id).single()
      expect(linha.data?.no_show_score).not.toBeNull()
      expect(linha.data?.risk_features).not.toBeNull()
    },
    30_000,
  )
})
