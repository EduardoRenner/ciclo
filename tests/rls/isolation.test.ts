import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Falta de credencial NÃO pode virar teste verde: o isolamento entre tenants é
// a garantia mais cara do produto e um "skip" silencioso aqui é pior que não ter
// teste nenhum.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'O teste de isolamento precisa de NEXT_PUBLIC_SUPABASE_URL, ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local. ' +
      'Pegue a service role key em Dashboard > Project Settings > API keys.',
  )
}

/**
 * Tabelas que ficam com RLS ligada e nenhuma política de propósito: sem política,
 * ninguém alcança pelo cliente, e é assim que a 0001 as deixou. Uma tabela nova
 * sem política que não esteja aqui reprova o teste — a escolha tem que ser
 * consciente, não esquecimento.
 */
const NEGADAS_POR_DESIGN = new Set(['idempotency_keys', 'job_queue'])



type RelatorioRls = {
  table_name: string
  rls_enabled: boolean
  rls_forced: boolean
  policy_count: number
}

type Fixture = {
  tenantId: string
  userId: string
  email: string
  senha: string
  professionalId: string
  serviceId: string
  productId: string
  clientId: string
  appointmentId: string
  ticketId: string
  ticketItemId: string
  packageId: string
  consentId: string
  subscriptionPlanId: string
  categoryId: string
  quoteId: string
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const criados: Fixture[] = []

// A descoberta roda no topo do módulo, e não em beforeAll, porque `it.each`
// precisa da lista no momento em que o Vitest coleta os testes — depois já é
// tarde e cada tabela deixaria de virar um caso próprio.
const relatorio = await admin.rpc('tenant_rls_report')
if (relatorio.error) throw new Error(`tenant_rls_report falhou: ${relatorio.error.message}`)
const tabelas = (relatorio.data ?? []) as RelatorioRls[]
const nomes = tabelas.map((t) => t.table_name)
const nomesAlcancaveis = nomes.filter((n) => !NEGADAS_POR_DESIGN.has(n))

let clienteA: SupabaseClient
let clienteB: SupabaseClient
let A: Fixture
let B: Fixture

/** Aborta na primeira falha: um seed pela metade produz teste que mente. */
function exigir(
  resultado: { data: unknown; error: { message: string } | null },
  onde: string,
): { id: string } {
  if (resultado.error) throw new Error(`seed falhou em ${onde}: ${resultado.error.message}`)
  const linha = resultado.data as { id?: string } | null
  if (!linha?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return { id: linha.id }
}

async function criarTenant(sufixo: string): Promise<Fixture> {
  const marca = randomUUID().slice(0, 8)
  const email = `rls-${sufixo}-${marca}@ciclo.test`
  const senha = randomUUID()

  const tenant = exigir(
    await admin
      .from('tenants')
      .insert({ name: `Tenant ${sufixo}`, slug: `rls-${sufixo}-${marca}`, vertical: 'lashes' })
      .select('id')
      .single(),
    'tenants',
  )

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (userError || !userData.user) throw new Error(`seed falhou ao criar usuário: ${userError?.message}`)
  const userId = userData.user.id

  // A trigger `on_auth_user_created` (migration 0006) já espelhou o profile. O
  // update no lugar do insert confirma que ela rodou: sem a linha, o `.single()`
  // não acha nada e o seed aborta aqui, antes do membership violar a FK.
  exigir(
    await admin.from('profiles').update({ full_name: `Dono ${sufixo}` }).eq('id', userId).select('id').single(),
    'profiles',
  )
  exigir(
    await admin
      .from('memberships')
      .insert({ tenant_id: tenant.id, user_id: userId, role: 'owner' })
      .select('id')
      .single(),
    'memberships',
  )

  const f = { tenantId: tenant.id, userId, email, senha } as Fixture
  await semear(f, sufixo)
  criados.push(f)
  return f
}

/** Uma linha em cada tabela com tenant_id, para haver o que tentar roubar. */
async function semear(f: Fixture, sufixo: string): Promise<void> {
  const t = f.tenantId

  f.categoryId = exigir(
    await admin.from('service_categories').insert({ tenant_id: t, name: 'Cílios' }).select('id').single(),
    'service_categories',
  ).id
  f.professionalId = exigir(
    await admin.from('professionals').insert({ tenant_id: t, display_name: `Profa ${sufixo}` }).select('id').single(),
    'professionals',
  ).id
  f.serviceId = exigir(
    await admin
      .from('services')
      .insert({
        tenant_id: t,
        category_id: f.categoryId,
        name: 'Volume russo',
        duration_min: 150,
        price_cents: 22000,
      })
      .select('id')
      .single(),
    'services',
  ).id
  f.productId = exigir(
    await admin
      .from('products')
      .insert({ tenant_id: t, name: 'Cola para cílios', unit: 'ml', avg_cost_cents: 9000 })
      .select('id')
      .single(),
    'products',
  ).id
  f.clientId = exigir(
    await admin
      .from('clients')
      .insert({ tenant_id: t, name: `Cliente ${sufixo}`, phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e8)}` })
      .select('id')
      .single(),
    'clients',
  ).id

  const inicio = new Date(Date.now() + 86_400_000).toISOString()
  const fim = new Date(Date.now() + 86_400_000 + 9_000_000).toISOString()
  f.appointmentId = exigir(
    await admin
      .from('appointments')
      .insert({
        tenant_id: t,
        client_id: f.clientId,
        professional_id: f.professionalId,
        service_id: f.serviceId,
        starts_at: inicio,
        ends_at: fim,
      })
      .select('id')
      .single(),
    'appointments',
  ).id

  f.ticketId = exigir(
    await admin
      .from('tickets')
      .insert({ tenant_id: t, client_id: f.clientId, professional_id: f.professionalId })
      .select('id')
      .single(),
    'tickets',
  ).id
  f.ticketItemId = exigir(
    await admin
      .from('ticket_items')
      .insert({
        tenant_id: t,
        ticket_id: f.ticketId,
        service_id: f.serviceId,
        description: 'Volume russo',
        unit_price_cents: 22000,
        total_cents: 22000,
      })
      .select('id')
      .single(),
    'ticket_items',
  ).id
  f.quoteId = exigir(
    await admin
      .from('quotes')
      .insert({ tenant_id: t, client_id: f.clientId, professional_id: f.professionalId })
      .select('id')
      .single(),
    'quotes',
  ).id
  f.packageId = exigir(
    await admin
      .from('packages')
      .insert({ tenant_id: t, client_id: f.clientId, service_id: f.serviceId, total_sessions: 4 })
      .select('id')
      .single(),
    'packages',
  ).id
  f.consentId = exigir(
    await admin
      .from('consents')
      .insert({ tenant_id: t, client_id: f.clientId, kind: 'health_data', version: '1.0', text_hash: 'x', granted: true })
      .select('id')
      .single(),
    'consents',
  ).id
  // `client_subscriptions.plan_id` referencia `subscription_plans`, então o plano precisa nascer
  // antes — não dá para entrar na lista simples de `restantes` como as outras tabelas.
  f.subscriptionPlanId = exigir(
    await admin
      .from('subscription_plans')
      .insert({ tenant_id: t, name: 'Plano de teste', price_cents: 9900, sessions_per_month: 4 })
      .select('id')
      .single(),
    'subscription_plans',
  ).id

  const restantes: Array<[string, Record<string, unknown>]> = [
    ['tenant_keys', { tenant_id: t, dek_wrapped: '\\xdeadbeef' }],
    ['business_hours', { tenant_id: t, weekday: 1, opens_at: '09:00', closes_at: '19:00' }],
    ['time_off', { tenant_id: t, starts_at: inicio, ends_at: fim }],
    ['professional_services', { tenant_id: t, professional_id: f.professionalId, service_id: f.serviceId }],
    [
      'appointment_series',
      {
        tenant_id: t,
        client_id: f.clientId,
        professional_id: f.professionalId,
        service_id: f.serviceId,
        tipo: 'semanal',
        weekday: 2,
        intervalo_semanas: 1,
        horario: '14:00',
        starts_on: '2026-09-01',
      },
    ],
    ['quote_items', { tenant_id: t, quote_id: f.quoteId, description: 'Item de teste', unit_price_cents: 5000, total_cents: 5000 }],
    ['service_products', { tenant_id: t, service_id: f.serviceId, product_id: f.productId, qty: 0.5 }],
    ['stock_moves', { tenant_id: t, product_id: f.productId, kind: 'in', qty: 10 }],
    ['waitlist', { tenant_id: t, client_id: f.clientId, service_id: f.serviceId }],
    [
      'client_cycles',
      { tenant_id: t, client_id: f.clientId, service_id: f.serviceId, personal_cycle_days: 21, value_at_risk_cents: 22000 },
    ],
    [
      'payments',
      { tenant_id: t, ticket_id: f.ticketId, client_id: f.clientId, kind: 'service', method: 'pix', amount_cents: 22000 },
    ],
    [
      'commissions',
      {
        tenant_id: t,
        professional_id: f.professionalId,
        ticket_item_id: f.ticketItemId,
        period_start: '2026-08-01',
        period_end: '2026-08-31',
        base_cents: 22000,
        bps: 3000,
        amount_cents: 6600,
      },
    ],
    ['package_uses', { tenant_id: t, package_id: f.packageId, appointment_id: f.appointmentId }],
    ['wallet_entries', { tenant_id: t, client_id: f.clientId, amount_cents: 5000, reason: 'cortesia' }],
    [
      'health_records',
      {
        tenant_id: t,
        client_id: f.clientId,
        form_key: 'lashes_v1',
        ciphertext: '\\xdeadbeef',
        iv: '\\xdeadbeef',
        auth_tag: '\\xdeadbeef',
        has_alert: true,
        alert_label: 'Alergia',
      },
    ],
    ['media', { tenant_id: t, client_id: f.clientId, storage_key: `${t}/foto.webp`, consent_id: f.consentId }],
    // Mesma exigência de sempre: `portfolio_photos` (TICKET-115, migration 0053) precisa de linha
    // aqui, ou a descoberta por introspecção acha a tabela e o teste genérico de "sobrou linha do
    // outro tenant" falha por não ter o que sobrar.
    ['portfolio_photos', { tenant_id: t, client_id: f.clientId, storage_key: `${t}/vitrine.webp` }],
    [
      'messages',
      { tenant_id: t, client_id: f.clientId, appointment_id: f.appointmentId, channel: 'whatsapp', kind: 'reminder' },
    ],
    ['campaigns', { tenant_id: t, name: 'Reativação', segment: {}, template: 'cycle_v1' }],
    [
      'invites',
      {
        tenant_id: t,
        email: `convite-${sufixo}@ciclo.test`,
        role: 'professional',
        token_hash: randomUUID().replace(/-/g, ''),
        invited_by: f.userId,
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    ],
    // TICKET-056 (em andamento em outra sessão) já criou a tabela no banco — sem
    // linha aqui, a descoberta por introspecção pega `push_subscriptions` e falha
    // o teste genérico de "sobrou linha do outro tenant" por não ter o que sobrar.
    // Não é a implementação do ticket, só o que a suíte de isolamento já exige de
    // qualquer tabela nova com `tenant_id` (ver comentário da função `semear`).
    [
      'push_subscriptions',
      { tenant_id: t, user_id: f.userId, endpoint: `https://push.exemplo.test/${sufixo}-${randomUUID()}`, p256dh: 'x', auth: 'x' },
    ],
    // Mesma exigência da `push_subscriptions` acima: toda tabela nova com `tenant_id` precisa de
    // uma linha aqui, ou a descoberta por introspecção acha a tabela e o teste genérico de
    // "sobrou linha do outro tenant" falha por não ter o que sobrar.
    [
      'message_templates',
      { tenant_id: t, slug: `seed_${sufixo}`, title: 'Modelo de teste', body: 'Oi {{nome}}' },
    ],
    // Mesma exigência de novo: `client_notes`/`loyalty_entries`/`client_subscriptions`
    // (CRM profundo, migration 0019) precisam de linha aqui para o teste ter o que sobrar.
    ['client_notes', { tenant_id: t, client_id: f.clientId, body: 'Nota de teste', author_id: f.userId }],
    ['loyalty_entries', { tenant_id: t, client_id: f.clientId, points: 10, reason: 'seed de teste' }],
    ['client_subscriptions', { tenant_id: t, client_id: f.clientId, plan_id: f.subscriptionPlanId, billing_day: 5 }],
    // Mesma exigência: `client_reviews` (CRM inovações, migration 0020) precisa de linha aqui.
    ['client_reviews', { tenant_id: t, appointment_id: f.appointmentId, client_id: f.clientId, rating: 5 }],
    ['audit_log', { tenant_id: t, action: 'seed.rls', entity: 'tenants', entity_id: t }],
    ['vault_access_log', { tenant_id: t, client_id: f.clientId, action: 'read' }],
    ['idempotency_keys', { key: randomUUID(), tenant_id: t, endpoint: '/v1/seed', request_hash: 'x' }],
    ['job_queue', { tenant_id: t, kind: 'seed' }],
    // Mesma exigência de sempre: `tenant_modules` (P3, migration 0025) precisa de
    // linha aqui para o teste ter o que sobrar.
    //
    // O valor era 'seed_de_teste' e passava porque a coluna não tinha restrição nenhuma. A
    // migration 0041 pôs chave estrangeira para `modules`, e o seed virou o primeiro a esbarrar
    // nela — que é literalmente o defeito que a FK existe para pegar (§L.6: módulo fantasma que
    // nunca liga nada e que nenhuma query acusa). Agora usa uma chave de verdade, e uma linha
    // que poderia existir de fato: desligado pelo dono.
    ['tenant_modules', { tenant_id: t, modulo: 'campaigns', ligado: false, origem: 'dono' }],
  ]

  for (const [tabela, linha] of restantes) {
    const { error } = await admin.from(tabela).insert(linha)
    if (error) throw new Error(`seed falhou em ${tabela}: ${error.message}`)
  }
}

async function entrar(f: Fixture): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email: f.email, password: f.senha })
  if (error) throw new Error(`não consegui autenticar ${f.email}: ${error.message}`)
  return c
}

beforeAll(async () => {
  A = await criarTenant('a')
  B = await criarTenant('b')
  clienteA = await entrar(A)
  clienteB = await entrar(B)
}, 180_000)

afterAll(async () => {
  for (const f of criados) {
    await admin.from('tenants').delete().eq('id', f.tenantId)
    await admin.from('job_queue').delete().eq('tenant_id', f.tenantId)
    await admin.from('idempotency_keys').delete().eq('tenant_id', f.tenantId)
    await admin.from('audit_log').delete().eq('tenant_id', f.tenantId)
    await admin.from('vault_access_log').delete().eq('tenant_id', f.tenantId)
    await admin.auth.admin.deleteUser(f.userId)
  }
}, 120_000)

describe('estrutura: toda tabela com tenant_id está protegida', () => {
  it('descobre as tabelas por introspecção, sem lista fixa no teste', () => {
    expect(tabelas.length).toBeGreaterThan(20)
    expect(nomes).toContain('clients')
    expect(nomes).toContain('health_records')
  })

  it('nenhuma tabela com tenant_id sem RLS habilitada e forçada', () => {
    const frouxas = tabelas.filter((t) => !t.rls_enabled || !t.rls_forced)
    expect(frouxas.map((t) => t.table_name)).toEqual([])
  })

  it('nenhuma tabela sem política fora da lista de negadas por design', () => {
    const semPolitica = tabelas.filter((t) => t.policy_count === 0 && !NEGADAS_POR_DESIGN.has(t.table_name))
    expect(semPolitica.map((t) => t.table_name)).toEqual([])
  })
})

describe('comportamento: o tenant B não alcança o tenant A', () => {
  it.each(nomes)(
    'select em %s não devolve linha do outro tenant',
    async (tabela) => {
      const { data, error } = await clienteB.from(tabela).select('tenant_id').eq('tenant_id', A.tenantId)
      // erro de permissão também serve: o que não pode é voltar dado.
      if (!error) expect(data ?? []).toEqual([])
    },
    60_000,
  )

  it.each(nomesAlcancaveis)(
    'update em %s não afeta linha do outro tenant',
    async (tabela) => {
      const { data, error } = await clienteB
        .from(tabela)
        .update({ tenant_id: A.tenantId })
        .eq('tenant_id', A.tenantId)
        .select('tenant_id')
      if (!error) expect(data ?? []).toEqual([])
    },
    60_000,
  )

  it.each(nomesAlcancaveis)(
    'delete em %s não afeta linha do outro tenant',
    async (tabela) => {
      const { data, error } = await clienteB.from(tabela).delete().eq('tenant_id', A.tenantId).select('tenant_id')
      if (!error) expect(data ?? []).toEqual([])
      const sobrou = await admin.from(tabela).select('tenant_id').eq('tenant_id', A.tenantId)
      expect((sobrou.data ?? []).length).toBeGreaterThan(0)
    },
    60_000,
  )

  it('insert com tenant_id alheio é recusado', async () => {
    const tentativas: Array<[string, Record<string, unknown>]> = [
      ['clients', { tenant_id: A.tenantId, name: 'Invasora' }],
      ['services', { tenant_id: A.tenantId, name: 'Invasor', duration_min: 30, price_cents: 100 }],
      ['professionals', { tenant_id: A.tenantId, display_name: 'Invasor' }],
      ['products', { tenant_id: A.tenantId, name: 'Invasor' }],
      ['campaigns', { tenant_id: A.tenantId, name: 'Invasora', segment: {}, template: 'x' }],
      [
        'invites',
        {
          tenant_id: A.tenantId,
          email: 'invasor@ciclo.test',
          role: 'professional',
          token_hash: randomUUID().replace(/-/g, ''),
          invited_by: B.userId,
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      ],
      [
        'health_records',
        {
          tenant_id: A.tenantId,
          client_id: A.clientId,
          form_key: 'lashes_v1',
          ciphertext: '\\xde',
          iv: '\\xde',
          auth_tag: '\\xde',
        },
      ],
    ]

    for (const [tabela, linha] of tentativas) {
      const { error } = await clienteB.from(tabela).insert(linha)
      expect(error, `insert em ${tabela} deveria ter sido recusado`).not.toBeNull()
    }
  }, 60_000)

  it('cada dono enxerga o próprio tenant — a RLS não travou tudo', async () => {
    const meus = await clienteA.from('clients').select('id,tenant_id')
    expect(meus.error).toBeNull()
    expect((meus.data ?? []).length).toBe(1)
    expect(meus.data?.[0]?.tenant_id).toBe(A.tenantId)
  }, 60_000)

  it('as tabelas negadas por design não devolvem nada nem para o próprio tenant', async () => {
    for (const tabela of NEGADAS_POR_DESIGN) {
      const { data, error } = await clienteA.from(tabela).select('tenant_id').eq('tenant_id', A.tenantId)
      if (!error) expect(data ?? []).toEqual([])
    }
  }, 60_000)

  it('funções de escrita com SECURITY DEFINER não estão abertas na API', async () => {
    const { error } = await clienteB.rpc('apply_vertical_pack', {
      p_tenant: A.tenantId,
      p_vertical: 'lashes',
    })
    expect(error, 'apply_vertical_pack não pode ser chamável por usuário logado').not.toBeNull()
  }, 60_000)

  it('somente-leitura: o cliente não escreve em audit_log nem em vault_access_log', async () => {
    // Trilha de auditoria que o próprio auditado consegue escrever não é trilha.
    const auditoria = await clienteB.from('audit_log').insert({ tenant_id: B.tenantId, action: 'forjado' })
    expect(auditoria.error, 'audit_log não pode aceitar escrita do cliente').not.toBeNull()

    const cofre = await clienteB
      .from('vault_access_log')
      .insert({ tenant_id: B.tenantId, client_id: B.clientId, action: 'read' })
    expect(cofre.error, 'vault_access_log não pode aceitar escrita do cliente').not.toBeNull()
  }, 60_000)
})
