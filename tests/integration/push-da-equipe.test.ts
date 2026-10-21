import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { inscricoesPushDaEquipe } from '@/server/services/push'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do push da equipe precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const usuarios: string[] = []
const tenants: string[] = []

let tenantId: string
let profissionalMarina: string
const aparelho: Record<'dona' | 'marina' | 'bia', string> = { dona: '', marina: '', bia: '' }

async function usuario(nome: string): Promise<string> {
  const { data, error } = await svc.auth.admin.createUser({
    email: `${nome}-${randomUUID().slice(0, 8)}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: nome },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  return data.user.id
}

async function inscrever(userId: string, quem: keyof typeof aparelho): Promise<void> {
  aparelho[quem] = `https://push.exemplo.invalido/${quem}-${randomUUID().slice(0, 8)}`
  const { error } = await svc
    .from('push_subscriptions')
    .insert({ tenant_id: tenantId, user_id: userId, endpoint: aparelho[quem], p256dh: 'p256dh-de-teste', auth: 'auth-de-teste' })
  if (error) throw new Error(`inscrição falhou: ${error.message}`)
}

beforeAll(async () => {
  const dona = await usuario('dona')
  const { tenant } = await executarOnboarding(svc, {
    userId: dona,
    businessName: 'Salão do Push de Teste',
    vertical: 'nails',
    slug: `push-${randomUUID().slice(0, 8)}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
  const { data: atual } = await svc.from('tenants').select('settings').eq('id', tenantId).single()
  await svc
    .from('tenants')
    .update({ settings: { ...((atual?.settings as object | null) ?? {}), restrict_professional_view: true } })
    .eq('id', tenantId)

  const marina = await usuario('marina')
  const bia = await usuario('bia')
  for (const u of [marina, bia]) {
    const { error } = await svc.from('memberships').insert({ tenant_id: tenantId, user_id: u, role: 'professional', active: true })
    if (error) throw new Error(`membership falhou: ${error.message}`)
  }
  const { data: p, error: erroP } = await svc
    .from('professionals')
    .insert({ tenant_id: tenantId, user_id: marina, display_name: 'Marina' })
    .select('id')
    .single()
  if (erroP || !p) throw new Error(`profissional falhou: ${erroP?.message}`)
  profissionalMarina = p.id
  await svc.from('professionals').insert({ tenant_id: tenantId, user_id: bia, display_name: 'Bia' })

  await inscrever(dona, 'dona')
  await inscrever(marina, 'marina')
  await inscrever(bia, 'bia')
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/**
 * docs/112 EXP-A06, contra o banco de verdade: com a visão restrita ligada, o pedido de horário da
 * Marina não pode chegar no aparelho da Bia (o corpo do push leva o nome da cliente).
 */
describe('o push da equipe vai só para quem precisa saber', () => {
  it('pedido para a Marina: chega na dona e na Marina, não na Bia', async () => {
    const endpoints = (await inscricoesPushDaEquipe(svc, tenantId, profissionalMarina)).map((i) => i.endpoint).sort()
    expect(endpoints).toEqual([aparelho.dona, aparelho.marina].sort())
  })

  it('aviso do negócio (sem profissional): só a dona', async () => {
    const endpoints = (await inscricoesPushDaEquipe(svc, tenantId, null)).map((i) => i.endpoint)
    expect(endpoints).toEqual([aparelho.dona])
  })
})
