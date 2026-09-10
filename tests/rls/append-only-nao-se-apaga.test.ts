import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mesma regra da pasta: falta de credencial NÃO vira teste verde.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'O teste append-only precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e ' +
      'SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

/**
 * A `0081` recortou `cycle_predictions` e `package_uses` — antes `for all using has_tenant`, que
 * deixa qualquer membro ativo apagar/reescrever pela porta lateral do PostgREST.
 *
 * `cycle_predictions` é append-only por design (`0064`): o Motor grava uma vez, nunca mais muda.
 * `package_uses` é o consumo de sessão de um pacote — desfazer é movimento compensatório, não
 * `DELETE`. As duas escritas do Motor são `service_role` (ignora RLS); o `insert` de
 * `package_uses` continua vindo do cliente do usuário e continua liberado.
 *
 * **Asserção pelo ESTADO via admin, nunca pelo `error`**: sob RLS um `update`/`delete` sem linha
 * permitida devolve **sucesso com zero linhas**. Reintroduzir `for all ... has_tenant` (mutação)
 * deixa os casos de "some" vermelhos — o CI (job "Banco e RLS") aplica do zero.
 */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Linha = { id?: string }
function exigir<T extends Linha>(r: { data: T | null; error: { message: string } | null }, onde: string): T & { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return r.data as T & { id: string }
}

let tenantId: string
let previsaoId: string
let usoId: string
let packageId: string
let cicloClientId: string
let cicloServiceId: string
let pontoId: string
let email: string
let senha: string
const userIds: string[] = []

beforeAll(async () => {
  const m = randomUUID().slice(0, 8)
  tenantId = exigir(
    await admin.from('tenants').insert({ name: `RLS append ${m}`, slug: `rls-append-${m}`, vertical: 'barber' }).select('id').single(),
    'tenants',
  ).id

  email = `rls-append-${m}@ciclo.test`
  senha = randomUUID()
  const { data: u, error: eu } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (eu || !u.user) throw new Error(`seed usuário: ${eu?.message}`)
  userIds.push(u.user.id)
  exigir(
    await admin.from('memberships').insert({ tenant_id: tenantId, user_id: u.user.id, role: 'professional' }).select('id').single(),
    'memberships',
  )

  const clientId = exigir(await admin.from('clients').insert({ tenant_id: tenantId, name: 'Cliente' }).select('id').single(), 'clients').id
  const serviceId = exigir(
    await admin.from('services').insert({ tenant_id: tenantId, name: 'Corte', duration_min: 30, price_cents: 5000 }).select('id').single(),
    'services',
  ).id
  cicloClientId = clientId
  cicloServiceId = serviceId

  previsaoId = exigir(
    await admin
      .from('cycle_predictions')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        service_id: serviceId,
        last_visit_on: '2026-08-01',
        predicted_on: '2026-08-22',
        personal_cycle_days: 21,
        default_cycle_days: 21,
        algo_version: 1,
      })
      .select('id')
      .single(),
    'cycle_predictions',
  ).id

  packageId = exigir(
    await admin
      .from('packages')
      .insert({ tenant_id: tenantId, client_id: clientId, service_id: serviceId, total_sessions: 5, paid_cents: 20000 })
      .select('id')
      .single(),
    'packages',
  ).id
  usoId = exigir(
    await admin.from('package_uses').insert({ tenant_id: tenantId, package_id: packageId }).select('id').single(),
    'package_uses',
  ).id

  // 0082
  if (
    (await admin.from('client_cycles').insert({ tenant_id: tenantId, client_id: clientId, service_id: serviceId, personal_cycle_days: 21 }))
      .error
  ) {
    throw new Error('seed client_cycles falhou')
  }
  if ((await admin.from('loyalty_entries').insert({ tenant_id: tenantId, client_id: clientId, points: 100, reason: 'seed' })).error) {
    throw new Error('seed loyalty_entries falhou')
  }
  pontoId = exigir(
    await admin
      .from('loyalty_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('reason', 'seed')
      .single(),
    'loyalty_entries id',
  ).id
  if (
    (
      await admin.from('monthly_profit').insert({
        tenant_id: tenantId,
        month: '2026-08-01',
        revenue_cents: 100000,
        material_cents: 10000,
        fee_cents: 2000,
        commission_cents: 30000,
        profit_cents: 58000,
        tickets_count: 12,
      })
    ).error
  ) {
    throw new Error('seed monthly_profit falhou')
  }
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const id of userIds) await admin.auth.admin.deleteUser(id)
}, 120_000)

async function entrar(): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(`autenticar: ${error.message}`)
  return c
}

describe('0081 · cycle_predictions e package_uses não se apagam pela porta lateral', () => {
  it('o membro LÊ a previsão (a tela de prestação de contas depende disso)', async () => {
    const c = await entrar()
    const { data } = await c.from('cycle_predictions').select('id').eq('id', previsaoId)
    expect((data ?? []).map((r) => r.id)).toEqual([previsaoId])
  })

  it('o membro NÃO reescreve a previsão (append-only)', async () => {
    const c = await entrar()
    await c.from('cycle_predictions').update({ predicted_on: '2030-01-01' }).eq('id', previsaoId)
    const { data } = await admin.from('cycle_predictions').select('predicted_on').eq('id', previsaoId).single()
    expect(data!.predicted_on).toBe('2026-08-22')
  })

  it('o membro NÃO apaga a previsão', async () => {
    const c = await entrar()
    await c.from('cycle_predictions').delete().eq('id', previsaoId)
    const { count } = await admin.from('cycle_predictions').select('id', { count: 'exact', head: true }).eq('id', previsaoId)
    expect(count).toBe(1)
  })

  it('o membro LÊ e INSERE package_uses (o consumo de sessão vem do cliente do usuário)', async () => {
    const c = await entrar()
    const leitura = await c.from('package_uses').select('id').eq('id', usoId)
    expect((leitura.data ?? []).map((r) => r.id)).toEqual([usoId])

    const insercao = await c.from('package_uses').insert({ tenant_id: tenantId, package_id: packageId }).select('id').single()
    expect(insercao.error, insercao.error?.message).toBeNull()
    expect(insercao.data?.id).toBeTruthy()
  })

  it('o membro NÃO apaga um consumo de sessão (desfazer é compensação, não DELETE)', async () => {
    const c = await entrar()
    await c.from('package_uses').delete().eq('id', usoId)
    const { count } = await admin.from('package_uses').select('id', { count: 'exact', head: true }).eq('id', usoId)
    expect(count).toBe(1)
  })
})

describe('0082 · client_cycles, loyalty_entries e monthly_profit param de aceitar DELETE', () => {
  it('client_cycles: UPDATE ainda funciona (o Motor faz upsert pelo cliente do usuário ao concluir atendimento)', async () => {
    const c = await entrar()
    const r = await c
      .from('client_cycles')
      .update({ late_days: 3 })
      .eq('tenant_id', tenantId)
      .eq('client_id', cicloClientId)
      .eq('service_id', cicloServiceId)
      .select('late_days')
    expect(r.error, r.error?.message).toBeNull()
    expect(r.data?.[0]?.late_days).toBe(3)
  })

  it('client_cycles: DELETE não passa', async () => {
    const c = await entrar()
    await c.from('client_cycles').delete().eq('tenant_id', tenantId).eq('client_id', cicloClientId)
    const { count } = await admin
      .from('client_cycles')
      .select('client_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('client_id', cicloClientId)
    expect(count).toBe(1)
  })

  it('loyalty_entries: INSERT funciona (lançar ponto), UPDATE e DELETE não', async () => {
    const c = await entrar()
    const ins = await c.from('loyalty_entries').insert({ tenant_id: tenantId, client_id: cicloClientId, points: -50, reason: 'resgate' }).select('id').single()
    expect(ins.error, ins.error?.message).toBeNull()

    await c.from('loyalty_entries').update({ points: 9999 }).eq('id', pontoId)
    await c.from('loyalty_entries').delete().eq('id', pontoId)
    const { data } = await admin.from('loyalty_entries').select('points').eq('id', pontoId).single()
    expect(data!.points).toBe(100) // nem editado, nem apagado
  })

  it('monthly_profit: UPDATE e DELETE não passam (append-only da 0071)', async () => {
    const c = await entrar()
    await c.from('monthly_profit').update({ profit_cents: 1 }).eq('tenant_id', tenantId).eq('month', '2026-08-01')
    await c.from('monthly_profit').delete().eq('tenant_id', tenantId).eq('month', '2026-08-01')
    const { data } = await admin.from('monthly_profit').select('profit_cents').eq('tenant_id', tenantId).eq('month', '2026-08-01').single()
    expect(data!.profit_cents).toBe(58000)
  })
})
