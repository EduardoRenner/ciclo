import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { registrarEvento, registrarPrimeiraOcorrencia } from '@/server/services/product-events'
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
 * G-05a (docs/60) — instrumentação mínima do funil: uma conta nova de teste tem que produzir
 * `conta_criada` e `motor_viu_valor`, e dá para calcular o intervalo entre os dois por SQL
 * (`min(created_at)` por `event_type`). Este arquivo prova as duas metades: `executarOnboarding`
 * grava o primeiro evento de verdade (não é chamada isolada a `registrarEvento`), e
 * `registrarPrimeiraOcorrencia` dedupe corretamente uma "primeira vez" por tenant.
 */
const tenants: string[] = []
const usuarios: string[] = []

async function novoTenant() {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `pe-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Funil',
    vertical: 'barber',
    slug: `pe-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)
  return tenant.id
}

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('registrarEvento / registrarPrimeiraOcorrencia', () => {
  it(
    'onboarding grava conta_criada de verdade — não é chamada isolada, é o fluxo real',
    async () => {
      const tenantId = await novoTenant()

      const { data } = await svc.from('product_events').select('event_type, meta').eq('tenant_id', tenantId)
      expect(data).toEqual([{ event_type: 'conta_criada', meta: { vertical: 'barber' } }])
    },
    30_000,
  )

  it(
    'motor_viu_valor entra e o intervalo desde conta_criada é calculável por SQL',
    async () => {
      const tenantId = await novoTenant()
      await registrarPrimeiraOcorrencia(svc, tenantId, 'motor_viu_valor', { count: 3 })

      const { data } = await svc
        .from('product_events')
        .select('event_type, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })

      expect(data?.map((e) => e.event_type)).toEqual(['conta_criada', 'motor_viu_valor'])
      if (!data) throw new Error('sem dados')

      const contaCriada = new Date(data[0]!.created_at).getTime()
      const motorViuValor = new Date(data[1]!.created_at).getTime()
      expect(motorViuValor - contaCriada, 'motor_viu_valor tem que vir depois de conta_criada').toBeGreaterThanOrEqual(0)
    },
    30_000,
  )

  it(
    'registrarPrimeiraOcorrencia não duplica — chamar duas vezes deixa UMA linha só',
    async () => {
      const tenantId = await novoTenant()
      await registrarPrimeiraOcorrencia(svc, tenantId, 'motor_viu_valor', { count: 1 })
      await registrarPrimeiraOcorrencia(svc, tenantId, 'motor_viu_valor', { count: 99 })

      const { data } = await svc.from('product_events').select('meta').eq('tenant_id', tenantId).eq('event_type', 'motor_viu_valor')
      expect(data).toHaveLength(1)
      expect(data?.[0]?.meta, 'a SEGUNDA chamada não pode ter sobrescrito o meta da primeira').toEqual({ count: 1 })
    },
    30_000,
  )

  it(
    'registrarEvento nunca lança — tenant inexistente vira log, não exceção',
    async () => {
      await expect(registrarEvento(svc, randomUUID(), 'conta_criada')).resolves.toBeUndefined()
    },
    30_000,
  )
})
