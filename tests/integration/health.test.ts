import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { registrarHeartbeat, verificarSaude } from '@/server/services/health'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de health precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `health-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Saúde' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Saúde',
    vertical: 'nails',
    slug: `health-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('verificarSaude', () => {
  it(
    'heartbeat recém-registrado: sendReminders ok',
    async () => {
      await registrarHeartbeat(svc, 'send_reminders')
      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.sendReminders.ok).toBe(true)
      expect(relatorio.checks.database.ok).toBe(true)
    },
    30_000,
  )

  it(
    'heartbeat parado há mais de 30 min dispara alerta',
    async () => {
      const trintaEUmMinutosAtras = new Date(Date.now() - 31 * 60_000)
      await svc.from('cron_heartbeats').upsert({ kind: 'send_reminders', last_run_at: trintaEUmMinutosAtras.toISOString() }, { onConflict: 'kind' })

      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.sendReminders.ok).toBe(false)
      expect(relatorio.ok).toBe(false)

      await registrarHeartbeat(svc, 'send_reminders') // devolve o estado saudável pros próximos testes/tenants
    },
    30_000,
  )

  it(
    'job parado na fila há mais de 15 min dispara alerta, sem afetar o resto',
    async () => {
      await registrarHeartbeat(svc, 'send_reminders')
      const dezesseisMinutosAtras = new Date(Date.now() - 16 * 60_000)
      const job = await svc
        .from('job_queue')
        .insert({ tenant_id: tenantId, kind: 'teste_saude', status: 'queued', run_after: dezesseisMinutosAtras.toISOString() })
        .select('id')
        .single()

      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.jobQueue.ok).toBe(false)
      expect(relatorio.ok).toBe(false)

      await svc.from('job_queue').delete().eq('id', job.data!.id)
    },
    30_000,
  )
})
