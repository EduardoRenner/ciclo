import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { raioXDeRecorrencia } from '@/server/services/clube'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * CICLO Clube · C-03. Prova que `raioXDeRecorrencia` lê `client_cycles` de verdade — não deduplica
 * errado (um cliente com dois serviços elegíveis não pode virar dois elegíveis) e respeita o
 * limite de 45 dias.
 */
let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `raio-x-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Raio-X',
    vertical: 'barber',
    slug: `raio-x-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function criarClienteComCiclo(cicloDias: number, servicePriceCents: number) {
  const { data: cliente } = await svc.from('clients').insert({ tenant_id: tenantId, name: `Cliente ${randomUUID().slice(0, 6)}` }).select('id').single()
  const { data: servico } = await svc
    .from('services')
    .insert({ tenant_id: tenantId, name: `Serviço ${randomUUID().slice(0, 6)}`, duration_min: 30, price_cents: servicePriceCents, cycle_days: cicloDias })
    .select('id')
    .single()
  await svc.from('client_cycles').insert({ tenant_id: tenantId, client_id: cliente!.id, service_id: servico!.id, personal_cycle_days: cicloDias })
  return cliente!.id
}

describe('raioXDeRecorrencia lê client_cycles de verdade', () => {
  it(
    'conta só quem tem ciclo ≤ 45 dias, e ignora quem tem ciclo mais longo',
    async () => {
      await criarClienteComCiclo(20, 5000)
      await criarClienteComCiclo(90, 5000) // fora do limite — não pode entrar na conta

      const raioX = await raioXDeRecorrencia(svc, tenantId)
      expect(raioX.totalElegiveis).toBe(1)
    },
    30_000,
  )

  it(
    'um cliente com DOIS serviços elegíveis conta como UM elegível só',
    async () => {
      const { data: cliente } = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Duplo Servico' }).select('id').single()
      const { data: s1 } = await svc.from('services').insert({ tenant_id: tenantId, name: 'A', duration_min: 30, price_cents: 4000, cycle_days: 20 }).select('id').single()
      const { data: s2 } = await svc.from('services').insert({ tenant_id: tenantId, name: 'B', duration_min: 30, price_cents: 8000, cycle_days: 30 }).select('id').single()
      await svc.from('client_cycles').insert([
        { tenant_id: tenantId, client_id: cliente!.id, service_id: s1!.id, personal_cycle_days: 20 },
        { tenant_id: tenantId, client_id: cliente!.id, service_id: s2!.id, personal_cycle_days: 30 },
      ])

      const raioX = await raioXDeRecorrencia(svc, tenantId)
      // Este cliente + os dois criados no caso anterior (só 1 elegível deles) = 2 no total.
      expect(raioX.totalElegiveis).toBe(2)
    },
    30_000,
  )
})
