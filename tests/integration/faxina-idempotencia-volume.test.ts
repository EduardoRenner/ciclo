import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { limparChavesDeIdempotencia } from '@/server/http/idempotency'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de volume da faxina precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-011 (achado no caminho): a faxina apagava até 500 chaves de uma vez com `.in('key', chaves)`.
 * Cada chave é `<tenant>:<uuid>` (~73 caracteres), então a partir de ~110 chaves a URL passava do
 * limite do gateway. O cron registrava o erro e devolvia 0 — e a tabela, que guarda o corpo das
 * respostas (dado pessoal), parava de ser limpa para sempre, sem nada ficar vermelho.
 */
const VENCIDAS = 300
let tenantId: string
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `faxina-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: 'Faxina', vertical: 'barber', slug: `faxina-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id

  const antiga = new Date(Date.now() - 40 * 86_400_000).toISOString()
  const linhas = Array.from({ length: VENCIDAS }, () => ({
    key: `${tenantId}:${randomUUID()}`,
    tenant_id: tenantId,
    endpoint: '/api/v1/clients',
    request_hash: 'x',
    response_status: 200,
    created_at: antiga,
  }))
  const r = await svc.from('idempotency_keys').insert(linhas)
  if (r.error) throw r.error
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('faxina de idempotência com volume (APR-011)', () => {
  it(
    `${VENCIDAS} chaves vencidas: apaga todas numa passada, sem erro`,
    async () => {
      // A 1ª passada é a que reprovava: apaga 300+ sem 414. O banco local pode ter vencidas de outros
      // testes, e a faxina tem teto de 500 por passada — então repete até zerar, como o cron faria.
      const primeira = await limparChavesDeIdempotencia(svc, new Date())
      expect(primeira.vencidas).toBeGreaterThanOrEqual(VENCIDAS)
      for (let passada = 0; passada < 5; passada++) {
        if ((await limparChavesDeIdempotencia(svc, new Date())).vencidas === 0) break
      }
      const { count } = await svc.from('idempotency_keys').select('key', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      expect(count).toBe(0)
    },
    60_000,
  )
})
