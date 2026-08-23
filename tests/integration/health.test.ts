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

  /*
   * FLAKE CONHECIDA, com a causa medida em 2026-08-23 (antes era atribuída a "contenção de rede
   * ao rodar 15 suítes contra a mesma nuvem", o que estava errado).
   *
   * A causa real: este teste insere um job `queued` com `run_after` no passado, que é exatamente
   * o critério de `claim_jobs`. Quando `job-queue.test.ts` roda em paralelo, o worker DELE
   * reivindica o job de fixture DESTE teste, o status vira `running`, e `checarFila` — que conta
   * `queued`/`failed` — não acha mais nada. Falha com `expected true to be false`.
   *
   * Não há estado "esperando na fila" que seja imune a isso: qualquer `queued`/`failed` com hora
   * vencida é elegível por definição, e é assim que a fila tem que funcionar. Deixado como está
   * de propósito — enfraquecer a asserção para o teste parar de piscar seria trocar um teste que
   * mede por um que acompanha. O caso `running` logo abaixo é determinístico e cobre a metade
   * nova.
   */
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

  it(
    'job preso em running há mais de 15 min também dispara alerta (achado S12)',
    async () => {
      await registrarHeartbeat(svc, 'send_reminders')
      const dezesseisMinutosAtras = new Date(Date.now() - 16 * 60_000)

      /*
       * `attempts` no teto de propósito, e é o que torna este teste determinístico: com
       * `attempts >= max_attempts`, o `claim_jobs` da migration 0037 NÃO reivindica de volta
       * (o teto existe para um job que derruba o worker toda vez parar de derrubar um worker por
       * rodada). Então nenhum worker rodando em paralelo consegue mexer nele.
       *
       * É também o cenário exato que o achado S12 descreve como o pior: o job esgotou as
       * tentativas preso em `running`, ninguém mais o pega — e, antes desta correção, ninguém
       * sequer o VIA, porque `checarFila` contava só `queued`/`failed`.
       */
      const job = await svc
        .from('job_queue')
        .insert({
          tenant_id: tenantId,
          kind: 'teste_saude_travado',
          status: 'running',
          locked_at: dezesseisMinutosAtras.toISOString(),
          attempts: 5,
          max_attempts: 5,
        })
        .select('id')
        .single()
      if (job.error) throw job.error

      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.jobQueue.ok).toBe(false)
      expect(relatorio.checks.jobQueue.detail).toMatch(/preso\(s\) em running/)

      await svc.from('job_queue').delete().eq('id', job.data!.id)
    },
    30_000,
  )
})
