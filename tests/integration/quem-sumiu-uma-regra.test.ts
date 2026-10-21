import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste de quem sumiu precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-035 (achado E-06): o alarme da Hoje e o Recuperar contavam "quem sumiu" por regras
 * diferentes — a apagada e quem pediu "PARAR" entravam num e não no outro. Cenário do aceite:
 * 1 apagada, 1 com opt-out, 1 com ciclo em dia (e outro atrasado), 3 atrasadas de verdade, e 1 sem
 * previsão. As duas telas têm que dizer 3.
 */
let tenantId: string
let servicoA: string
let servicoB: string
const usuarios: string[] = []

async function cliente(nome: string, extra: Partial<Database['public']['Tables']['clients']['Insert']> = {}) {
  const r = await svc.from('clients').insert({ tenant_id: tenantId, name: nome, ...extra }).select('id').single()
  if (r.error) throw r.error
  return r.data.id
}

async function ciclo(clientId: string, serviceId: string, state: Database['public']['Enums']['cycle_state'], previsto: string | null = '2026-09-01') {
  const r = await svc.from('client_cycles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    service_id: serviceId,
    personal_cycle_days: 30,
    state,
    late_days: state === 'on_track' ? 0 : 40,
    predicted_on: previsto,
    value_at_risk_cents: 5_000,
    profit_at_risk_cents: 3_000,
  })
  if (r.error) throw r.error
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr035-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: 'Quem Sumiu', vertical: 'barber', slug: `apr035-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  const servicos = (await svc.from('services').select('id').eq('tenant_id', tenantId).eq('active', true).limit(2)).data!
  servicoA = servicos[0]!.id
  servicoB = servicos[1]!.id

  for (const nome of ['Atrasada 1', 'Atrasada 2', 'Atrasada 3']) await ciclo(await cliente(nome), servicoA, 'late')
  await ciclo(await cliente('Apagada', { deleted_at: new Date().toISOString() }), servicoA, 'late')
  await ciclo(await cliente('Pediu PARAR', { whatsapp_opt_out: true }), servicoA, 'lost')
  const emDia = await cliente('Vem todo mês')
  await ciclo(emDia, servicoA, 'on_track')
  await ciclo(emDia, servicoB, 'late')
  await ciclo(await cliente('Sem previsão'), servicoA, 'late', null)
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('quem sumiu: uma regra para a Hoje e o Recuperar (APR-035)', () => {
  it(
    'o alarme da Hoje e o Recuperar dizem 3, os mesmos 3',
    async () => {
      const resumo = await svc.rpc('resumo_central_de_acoes', { p_tenant: tenantId }).single()
      expect(resumo.error).toBeNull()
      const recuperar = await listarParaRecuperar(svc, tenantId)

      expect((resumo.data as { em_risco: number }).em_risco).toBe(3)
      expect(recuperar.count).toBe(3)
      expect(recuperar.items.map((i) => i.name).sort()).toEqual(['Atrasada 1', 'Atrasada 2', 'Atrasada 3'])
    },
    30_000,
  )

  it('a view nova não abre para anon (privilégio mínimo, 0117)', async () => {
    const anon = createClient<Database>(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    const r = await anon.from('v_quem_sumiu').select('client_id').eq('tenant_id', tenantId)
    expect(r.error?.code).toBe('42501')
  })
})
