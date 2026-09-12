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
 * `public.v_cron_status` (criada na própria `0087`) é a única porta: `cron.job` não é schema que
 * o PostgREST expõe, e a view existe só para este teste enxergar o agendamento sem precisar de
 * uma dependência nova (`pg`) neste projeto.
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
  it('os dois jobs existem, estão ativos, e com o schedule esperado', async () => {
    const { data, error } = await svc.from('v_cron_status').select('jobname, schedule, active')
    expect(error, error?.message).toBeNull()

    const porNome = new Map((data ?? []).map((j) => [j.jobname, j]))

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
    const { data } = await svc.from('v_cron_status').select('jobname, schedule')
    const porNome = new Map((data ?? []).map((j) => [j.jobname, j.schedule]))
    expect(porNome.get('ciclo_recompute_cycles')).not.toBe(porNome.get('ciclo_recompute_segments'))
  })
})
