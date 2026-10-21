import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { margensDoClube } from '@/server/services/clube'
import { assinar, criarPlano } from '@/server/services/fidelidade'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do clube precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `clube-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Clube' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: 'Salão do Clube', vertical: 'barber', slug: `clube-${marca}`, timezone: TZ })
  tenantId = tenant.id
  tenants.push(tenantId)
  const profissional = await criarProfissional(svc, tenantId, { displayName: 'Quem Atende', compModel: 'commission', commissionBps: 4_000, rentCents: 0, acceptsOnline: true })
  professionalId = profissional.id
  const servico = await criarServico(svc, tenantId, {
    // O onboarding de barbearia já cria "Corte"; nome próprio para não colidir.
    name: 'Corte do Clube',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 5_000,
    pricingModel: 'fixed',
    cycleDays: 30,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/** Visita concluída HOJE (dentro de qualquer janela de cobrança), com ou sem comanda fechada. */
async function visita(clientId: string, hora: string, comanda: { comissao: number; material: number } | null) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const { data: ag, error } = await svc
    .from('appointments')
    .insert({ tenant_id: tenantId, client_id: clientId, professional_id: professionalId, service_id: servicoId, starts_at: `${hoje}T${hora}:00-03:00`, ends_at: `${hoje}T${hora}:30-03:00`, status: 'done', origin: 'app', price_cents: 5_000 })
    .select('id')
    .single()
  if (error) throw error
  if (comanda) {
    const { data: tk, error: e2 } = await svc
      .from('tickets')
      .insert({ tenant_id: tenantId, client_id: clientId, professional_id: professionalId, appointment_id: ag.id, status: 'closed', total_cents: 5_000, commission_cents: comanda.comissao, material_cost_cents: comanda.material, closed_at: new Date().toISOString() })
      .select('id')
      .single()
    if (e2) throw e2
    const { error: e3 } = await svc.from('ticket_items').insert({
      tenant_id: tenantId,
      ticket_id: tk.id,
      service_id: servicoId,
      professional_id: professionalId,
      description: 'Corte',
      qty: 1,
      unit_price_cents: 5_000,
      discount_cents: 0,
      total_cents: 5_000,
      commission_bps: 4_000,
      commission_cents: comanda.comissao,
      cost_cents: comanda.material,
    })
    if (e3) throw e3
  }
}

describe('margem do clube usa a comissão e o material que FORAM PAGOS (APR-210)', () => {
  it(
    'com comanda fechada o custo vem do item; mudar o % de comissão depois não muda a margem',
    async () => {
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Assinante Com Comanda' }).select('id').single()
      const plano = await criarPlano(svc, tenantId, { name: 'Clube', priceCents: 20_000, sessionsPerMonth: 4, benefits: null, active: true })
      await assinar(svc, tenantId, cliente.data!.id, { planId: plano.id, billingDay: 1 }, TZ)
      await visita(cliente.data!.id, '09:00', { comissao: 1_500, material: 500 })

      const antes = (await margensDoClube(svc, tenantId, TZ)).find((m) => m.clientId === cliente.data!.id)
      expect(antes?.custoCents).toBe(2_000)

      await svc.from('professionals').update({ commission_bps: 9_000 }).eq('id', professionalId)
      const depois = (await margensDoClube(svc, tenantId, TZ)).find((m) => m.clientId === cliente.data!.id)
      expect(depois?.custoCents).toBe(2_000)
    },
    30_000,
  )

  it(
    'visita sem comanda continua pelo percentual do profissional (não há valor pago para ler)',
    async () => {
      await svc.from('professionals').update({ commission_bps: 4_000 }).eq('id', professionalId)
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Assinante Sem Comanda' }).select('id').single()
      const plano = await criarPlano(svc, tenantId, { name: 'Clube 2', priceCents: 20_000, sessionsPerMonth: 4, benefits: null, active: true })
      await assinar(svc, tenantId, cliente.data!.id, { planId: plano.id, billingDay: 1 }, TZ)
      await visita(cliente.data!.id, '11:00', null)

      const margem = (await margensDoClube(svc, tenantId, TZ)).find((m) => m.clientId === cliente.data!.id)
      // 40% de R$ 50 sobre a base bruta, sem material de ficha.
      expect(margem?.custoCents).toBe(2_000)
    },
    30_000,
  )
})
