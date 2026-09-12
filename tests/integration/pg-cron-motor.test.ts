import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * `0087` — pg_cron como SEGUNDA rede do Motor de Ciclo, independente do GitHub Actions.
 *
 * `public.status_do_cron_do_motor()` (criada na própria `0087`) é a única porta: `cron.job` não é
 * schema que o PostgREST expõe, e a função existe só para este teste enxergar o agendamento sem
 * precisar de uma dependência nova (`pg`) neste projeto. É `security definer` — mesmo padrão de
 * `migracoes_aplicadas()` (`0062`) — e não uma view, porque a guarda `view-nao-fura-a-rls` exige
 * `security_invoker` em TODA view deste repositório, e aqui isso quebraria o propósito: `cron.job`
 * tem RLS por `username`, e `service_role` não é quem agendou o job.
 *
 * O que este arquivo prova: o agendamento sobrevive a `supabase db reset` e continua ativo. O que
 * ele NÃO prova: que `net.http_get` chega na rota de verdade — isso foi verificado à mão contra o
 * `next dev` local (200 em `recompute-cycles` e `segments`, 401 com segredo errado), porque
 * automatizar isso em CI exigiria subir o Next inteiro dentro do job de banco, que hoje só sobe o
 * Supabase. Guarda de agendamento e guarda de execução são duas coisas — só a primeira é viável
 * aqui, e ela sozinha já pega o defeito mais provável (migration não aplicada, nome de job errado,
 * cron desativado, ou os dois horários colidindo).
 */
describe('0087 · pg_cron agenda as duas rotas seguras do Motor', () => {
  async function statusDoCron() {
    const { data, error } = await svc.rpc('status_do_cron_do_motor')
    expect(error, error?.message).toBeNull()
    return data ?? []
  }

  it('os dois jobs existem, estão ativos, e com o schedule esperado', async () => {
    const jobs = await statusDoCron()
    const porNome = new Map(jobs.map((j) => [j.jobname, j]))

    expect(porNome.get('ciclo_recompute_cycles'), 'job do Motor de Ciclo sumiu de cron.job').toMatchObject({
      schedule: '20 * * * *',
      active: true,
    })
    expect(porNome.get('ciclo_recompute_segments'), 'job de segmentos sumiu de cron.job').toMatchObject({
      schedule: '50 * * * *',
      active: true,
    })
  })

  it('os dois horários são diferentes — redundância que falha junto na mesma hora não é redundância', async () => {
    const jobs = await statusDoCron()
    const porNome = new Map(jobs.map((j) => [j.jobname, j.schedule]))
    expect(porNome.get('ciclo_recompute_cycles')).not.toBe(porNome.get('ciclo_recompute_segments'))
  })
})
