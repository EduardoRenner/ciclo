import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { comNotas } from '@/server/services/notas-do-cliente'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de volume das notas precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-011: `comNotas` punha os ids de toda a lista do Recuperar na URL. O 414 começa entre 210 e
 * 220 ids no gateway; o erro virava `INTERNAL` e a página do Recuperar caía inteira. 250 pessoas,
 * acima do limite medido.
 */
const PESSOAS = 250
let tenantId: string
const usuarios: string[] = []
const clientes: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `notas-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: 'Notas', vertical: 'barber', slug: `notas-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id

  const criados = await svc
    .from('clients')
    .insert(Array.from({ length: PESSOAS }, (_, i) => ({ tenant_id: tenantId, name: `Pessoa ${i}` })))
    .select('id')
  if (criados.error) throw criados.error
  clientes.push(...criados.data.map((c) => c.id))

  const notas = clientes.map((client_id, i) => ({
    tenant_id: tenantId,
    client_id,
    score: 30 + (i % 70),
    tier: i % 2 ? 'ouro' : 'prata',
    profile: 'fiel',
    algo_version: 1,
    computed_at: new Date().toISOString(),
  }))
  const r = await svc.from('client_scores').insert(notas)
  if (r.error) throw r.error
}, 120_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('notas do Recuperar com lista grande (APR-011)', () => {
  it(
    `${PESSOAS} pessoas: abre, e cada uma volta com a própria nota`,
    async () => {
      const itens = await comNotas(svc, tenantId, clientes.map((clientId) => ({ clientId })))
      expect(itens).toHaveLength(PESSOAS)
      expect(itens.filter((i) => i.nota === null)).toEqual([])
      expect(itens[7]!.nota).toBe(37)
    },
    60_000,
  )
})
