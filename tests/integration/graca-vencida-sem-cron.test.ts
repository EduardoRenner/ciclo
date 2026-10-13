import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { expirarGracaVencida } from '@/server/services/assinatura-mp'
import { executarOnboarding } from '@/server/services/onboarding'
import { contextoDePlano, negocioEstaPausado } from '@/server/services/planos'

import type { Database } from '@/server/db/types.gen'

// As regras de plano valem com `ACESSO_ABERTO` desligado (aberto, todo mundo lê como o maior degrau).
vi.mock('@/core/billing/acesso-aberto', () => ({ ACESSO_ABERTO: false }))

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste da graça vencida precisa das chaves do Supabase local no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-027b (C-06): `tenants.plan` só caía quando o cron `expirar-graca` rodava, e ele estava sem
 * gatilho. Os cinco casos do ticket, lidos do banco de verdade pelo `settings->assinatura` do
 * PostgREST, sem rodar o cron; depois o cron grava a queda.
 */
const tenants: string[] = []
const usuarios: string[] = []
/*
 * O relógio da LEITURA vai 10 dias à frente (`contextoDePlano` aceita `agora`), e as datas de graça
 * ficam no futuro real: o cron global que outros arquivos rodam em paralelo (`assinatura-iniciar`)
 * não toca nestes tenants, e "sem rodar o cron" fica provado sem corrida.
 */
const dia = 86_400_000
const leitura = new Date(Date.now() + 10 * dia)
const vencidaNaLeitura = new Date(Date.now() + 5 * dia).toISOString()
const vigenteNaLeitura = new Date(Date.now() + 20 * dia).toISOString()

function assinatura(status: string, extra: Record<string, string | null> = {}) {
  return {
    provedor: 'mercado_pago',
    preapproval_id: `pre-${randomUUID().slice(0, 8)}`,
    plano_contratado: 'equipe',
    status,
    atualizado_em: new Date().toISOString(),
    graca_ate: null,
    acesso_ate: null,
    ...extra,
  }
}

async function negocio(plan: 'gratis' | 'essencial' | 'equipe' | 'avancado', settings: Record<string, unknown>) {
  const marca = randomUUID().slice(0, 8)
  const { data } = await svc.auth.admin.createUser({ email: `apr027-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  usuarios.push(data.user!.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user!.id, businessName: `Graça ${marca}`, vertical: 'barber', slug: `apr027-${marca}`, timezone: 'America/Sao_Paulo' })
  tenants.push(tenant.id)
  // Sem a cortesia do cadastro, salvo onde o caso pede: ela entraria no "maior dos dois" e esconderia a queda.
  const { error } = await svc.from('tenants').update({ plan, settings: settings as never }).eq('id', tenant.id)
  if (error) throw error
  return tenant.id
}

let emDia: string
let gracaVigente: string
let gracaVencida: string
let gracaNula: string
let comCortesia: string

beforeAll(async () => {
  emDia = await negocio('equipe', { assinatura: assinatura('authorized') })
  gracaVigente = await negocio('equipe', { assinatura: assinatura('paused', { graca_ate: vigenteNaLeitura }) })
  gracaVencida = await negocio('equipe', { assinatura: assinatura('paused', { graca_ate: vencidaNaLeitura }) })
  gracaNula = await negocio('equipe', { assinatura: assinatura('paused') })
  comCortesia = await negocio('equipe', {
    assinatura: assinatura('paused', { graca_ate: vencidaNaLeitura }),
    cortesia: { plano: 'avancado', ate: vigenteNaLeitura, origem: 'pre_lancamento', concedida_em: new Date().toISOString(), fundador: true },
  })
}, 120_000)

afterAll(async () => {
  for (const id of tenants) await svc.from('tenants').delete().eq('id', id)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('plano pago vencido cai na hora, sem cron (APR-027b)', () => {
  it('os cinco casos, lidos do banco sem rodar o cron', async () => {
    expect((await contextoDePlano(svc, emDia, leitura)).planoPago, 'pago em dia').toBe('equipe')
    expect((await contextoDePlano(svc, gracaVigente, leitura)).planoPago, 'graça vigente').toBe('equipe')
    expect((await contextoDePlano(svc, gracaVencida)).planoPago, 'controle: hoje a graça ainda vale').toBe('equipe')
    expect((await contextoDePlano(svc, gracaVencida, leitura)).planoPago, 'graça vencida').toBe('gratis')
    expect((await contextoDePlano(svc, gracaVencida, leitura)).plano, 'graça vencida, degrau de leitura').toBe('gratis')
    expect((await contextoDePlano(svc, gracaNula, leitura)).planoPago, '`graca_ate` nulo').toBe('equipe')
    const cortesia = await contextoDePlano(svc, comCortesia, leitura)
    expect(cortesia.planoPago, 'cortesia: o que paga caiu').toBe('gratis')
    expect(cortesia.plano, 'cortesia: a cortesia em pé continua valendo').toBe('avancado')

    // Nada foi gravado: a queda é da leitura.
    const { data } = await svc.from('tenants').select('plan').eq('id', gracaVencida).single()
    expect(data!.plan).toBe('equipe')
  })

  it('a página pública lê o mesmo degrau: graça vencida sem cortesia não pausa quem só caiu para o Grátis', async () => {
    const { data } = await svc.from('tenants').select('plan, settings').eq('id', gracaVencida).single()
    expect(negocioEstaPausado(data!.plan, data!.settings, leitura)).toBe(false)
  })

  it(
    'o cron grava a queda de quem venceu no relógio real, e só dele',
    async () => {
      const vencido = await negocio('equipe', { assinatura: assinatura('paused', { graca_ate: new Date(Date.now() - dia).toISOString() }) })
      expect((await contextoDePlano(svc, vencido)).planoPago, 'antes do cron, a leitura já cai').toBe('gratis')

      // Outro arquivo pode ter rodado o cron no meio: o que se afirma é o estado gravado, não a contagem desta chamada.
      await expirarGracaVencida(svc)
      const { data } = await svc.from('tenants').select('id, plan').in('id', [vencido, emDia, gracaVigente, gracaVencida, gracaNula, comCortesia])
      const plano = new Map((data ?? []).map((t) => [t.id, t.plan]))
      expect(plano.get(vencido), 'o cron gravou a queda').toBe('gratis')
      expect([plano.get(emDia), plano.get(gracaVigente), plano.get(gracaVencida), plano.get(gracaNula), plano.get(comCortesia)], 'ninguém com a graça vigente no relógio real caiu').toEqual([
        'equipe',
        'equipe',
        'equipe',
        'equipe',
        'equipe',
      ])
      const { count } = await svc.from('audit_log').select('id', { count: 'exact', head: true }).eq('tenant_id', vencido).eq('action', 'tenant.plan.change')
      expect(count, 'a queda deixou trilha').toBe(1)
    },
    60_000,
  )
})
