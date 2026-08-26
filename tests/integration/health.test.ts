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
  /*
   * A vigilância de heartbeat é condicionada ao `on.schedule` do `cron.yml` desde 26/08
   * (`src/core/cron/agendadas.ts`): job que ninguém dispara não pode ser cobrado, senão o
   * `/api/health` vive em 503 e o vermelho que importa some no meio do vermelho de sempre.
   *
   * Por isso os casos abaixo usam `recompute_cycles` para provar a COBRANÇA — hoje ele é o único
   * heartbeat de rota agendada — e `send_reminders`/`send_campaigns` para provar a DISPENSA.
   * O limiar de 30 min (`LIMIAR_HEARTBEAT_MIN`) fica sem exercício de propósito: o único job que
   * o usaria está fora do schedule. No dia em que `reminders` entrar, ele volta sozinho — e o
   * `saude-vigia-so-o-que-roda` reprova se a lista do código não acompanhar o YAML.
   */
  it(
    'job agendado com heartbeat recente: ok',
    async () => {
      await registrarHeartbeat(svc, 'recompute_cycles')
      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.recomputeCycles.ok).toBe(true)
      expect(relatorio.checks.database.ok).toBe(true)
    },
    30_000,
  )

  it(
    'job agendado parado além do limiar dispara alerta',
    async () => {
      const vinteSeteHorasAtras = new Date(Date.now() - 27 * 60 * 60_000)
      await svc
        .from('cron_heartbeats')
        .upsert({ kind: 'recompute_cycles', last_run_at: vinteSeteHorasAtras.toISOString() }, { onConflict: 'kind' })

      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.recomputeCycles.ok).toBe(false)
      expect(relatorio.ok).toBe(false)

      await registrarHeartbeat(svc, 'recompute_cycles') // devolve o estado saudável pros próximos testes
    },
    30_000,
  )

  it(
    'job FORA do schedule não derruba a saúde, mesmo parado há horas — era o 503 permanente da produção',
    async () => {
      await registrarHeartbeat(svc, 'recompute_cycles')
      // 454 min foi o número real medido em produção em 26/08, no `send_reminders`.
      const horasAtras = new Date(Date.now() - 454 * 60_000)
      await svc.from('cron_heartbeats').upsert({ kind: 'send_reminders', last_run_at: horasAtras.toISOString() }, { onConflict: 'kind' })
      await svc.from('cron_heartbeats').upsert({ kind: 'send_campaigns', last_run_at: horasAtras.toISOString() }, { onConflict: 'kind' })

      const relatorio = await verificarSaude(svc)
      expect(relatorio.checks.sendReminders.ok).toBe(true)
      expect(relatorio.checks.sendReminders.detail).toMatch(/não está no schedule/)
      expect(relatorio.checks.sendCampaigns.ok).toBe(true)
      /*
       * `relatorio.ok` NÃO é afirmado aqui de propósito. A fila é global e `job-queue.test.ts`
       * roda em paralelo contra o mesmo banco (a flake documentada logo abaixo), então um `ok`
       * geral verdadeiro depende de um estado que este teste não controla. O que ele tem que
       * provar é que os dois checks dispensados param de contribuir para o vermelho — e isso as
       * duas asserções acima já provam. O caminho do `ok` geral está coberto sem rede em
       * `tests/unit/server/saude-vigia-so-o-que-roda.test.ts`.
       */
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
      await registrarHeartbeat(svc, 'recompute_cycles') // tabela global — sem isto, o único check vigiado derruba `relatorio.ok` por motivo alheio a este teste.
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
      await registrarHeartbeat(svc, 'recompute_cycles') // tabela global — sem isto, o único check vigiado derruba `relatorio.ok` por motivo alheio a este teste.
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
