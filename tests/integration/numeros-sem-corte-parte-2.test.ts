import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { publicoDaCampanha } from '@/server/services/crm'
import { executarOnboarding } from '@/server/services/onboarding'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste de volume precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-013 (achado E-02, parte 2): o Recuperar e o público "sumidos" das campanhas liam a lista de
 * quem sumiu numa consulta só; o PostgREST corta em 1.000 linhas SEM erro. 1.200 pessoas atrasadas,
 * todas com telefone e aceite de marketing: o número tem que ser 1.200 nos dois.
 */
const N = 1_200
let tenantId: string
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr013-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Volume APR-013', vertical: 'barber', slug: `apr013-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  const servico = (await svc.from('services').select('id').eq('tenant_id', tenantId).eq('active', true).limit(1).single()).data!.id

  for (let i = 0; i < N; i += 300) {
    const r = await svc
      .from('clients')
      .insert(Array.from({ length: Math.min(300, N - i) }, (_, k) => ({ tenant_id: tenantId, name: `Sumida ${i + k}`, phone_e164: `+55119${String(10_000_000 + i + k)}`, marketing_opt_in: true })))
      .select('id')
    if (r.error) throw r.error
    const ciclos = await svc.from('client_cycles').insert(
      r.data.map((c) => ({ tenant_id: tenantId, client_id: c.id, service_id: servico, personal_cycle_days: 30, state: 'late' as const, late_days: 40, predicted_on: '2026-09-01', value_at_risk_cents: 5_000, profit_at_risk_cents: 3_000 })),
    )
    if (ciclos.error) throw ciclos.error
  }
}, 180_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 120_000)

describe('números sem corte de 1.000 linhas, parte 2 (APR-013)', () => {
  it(
    `Recuperar: ${N} pessoas e o total certo`,
    async () => {
      const lista = await listarParaRecuperar(svc, tenantId)
      expect(lista.count).toBe(N)
      expect(lista.totalValueCents).toBe(N * 5_000)
    },
    120_000,
  )

  it(
    `público "sumidos" da campanha: ${N} pessoas`,
    async () => {
      const publico = await publicoDaCampanha(svc, tenantId, 'sumidos')
      expect(publico).toHaveLength(N)
    },
    120_000,
  )
})
