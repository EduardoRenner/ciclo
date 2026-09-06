import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Mesma regra dos outros testes desta pasta: falta de credencial NÃO vira teste
// verde. O que este arquivo guarda — o financeiro de um profissional não vaza
// para outro — é a correção da migration 0073, e um skip silencioso devolveria
// exatamente o buraco que ela fechou.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    'O teste de ticket por profissional precisa de NEXT_PUBLIC_SUPABASE_URL, ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.',
  )
}

/**
 * O buraco que a 0073 fechou, e como este teste o pega.
 *
 * Antes da 0073, `tickets`/`ticket_items` tinham só `*_tenant_all`
 * (`for all using (has_tenant(tenant_id))`). Um profissional autenticado que
 * chamasse a REST API do Supabase direto, com o próprio JWT, lia
 * `commission_cents`/`cost_cents`/`total_cents` de qualquer colega do salão.
 *
 * Reintroduzir o defeito para conferir (regra do CLAUDE.md): trocar as políticas
 * de SELECT da 0073 de volta por `for all ... has_tenant` faz a Bia enxergar a
 * comanda da Ana e o caso `select da Bia não vê a comanda da Ana` fica vermelho.
 * O CI (`job "Banco e RLS"`) aplica as migrations do zero em cada execução, então
 * é lá que essa volta seria pega em PR.
 *
 * A trava depende de `tenants.settings.restrict_professional_view = true` — é o
 * mesmo interruptor de `can_see_appointment`, e `can_see_ticket` delega para ele.
 * Com o interruptor DESLIGADO o produto libera a visão de propósito, e o último
 * caso deste arquivo prova justamente isso, para a régua não virar "sempre nega".
 */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

type Prof = { email: string; senha: string; userId: string; professionalId: string; ticketId: string; itemId: string }

let tenantId: string
let serviceId: string
let clientId: string
const ana = {} as Prof
const bia = {} as Prof
const criados: string[] = [] // userIds para limpar

function exigir<T extends { id?: string }>(
  r: { data: T | null; error: { message: string } | null },
  onde: string,
): T & { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return r.data as T & { id: string }
}

async function criarProfissional(nome: string, alvo: Prof): Promise<void> {
  const marca = randomUUID().slice(0, 8)
  alvo.email = `rls-prof-${nome}-${marca}@ciclo.test`
  alvo.senha = randomUUID()

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: alvo.email,
    password: alvo.senha,
    email_confirm: true,
  })
  if (userError || !userData.user) throw new Error(`seed falhou ao criar usuário ${nome}: ${userError?.message}`)
  alvo.userId = userData.user.id
  criados.push(alvo.userId)

  // A trigger `on_auth_user_created` (0006) já espelhou o profile.
  exigir(
    await admin.from('profiles').update({ full_name: `Profa ${nome}` }).eq('id', alvo.userId).select('id').single(),
    `profiles ${nome}`,
  )
  exigir(
    await admin
      .from('memberships')
      .insert({ tenant_id: tenantId, user_id: alvo.userId, role: 'professional' })
      .select('id')
      .single(),
    `memberships ${nome}`,
  )
  alvo.professionalId = exigir(
    await admin
      .from('professionals')
      .insert({ tenant_id: tenantId, user_id: alvo.userId, display_name: `Profa ${nome}` })
      .select('id')
      .single(),
    `professionals ${nome}`,
  ).id
  alvo.ticketId = exigir(
    await admin
      .from('tickets')
      .insert({ tenant_id: tenantId, client_id: clientId, professional_id: alvo.professionalId, total_cents: 22000 })
      .select('id')
      .single(),
    `tickets ${nome}`,
  ).id
  alvo.itemId = exigir(
    await admin
      .from('ticket_items')
      .insert({
        tenant_id: tenantId,
        ticket_id: alvo.ticketId,
        service_id: serviceId,
        professional_id: alvo.professionalId,
        description: 'Volume russo',
        unit_price_cents: 22000,
        total_cents: 22000,
        commission_cents: 8800,
      })
      .select('id')
      .single(),
    `ticket_items ${nome}`,
  ).id
}

async function entrar(p: Prof): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email: p.email, password: p.senha })
  if (error) throw new Error(`não consegui autenticar ${p.email}: ${error.message}`)
  return c
}

let ownerEmail: string
let ownerSenha: string
let ownerUserId: string

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  tenantId = exigir(
    await admin
      .from('tenants')
      .insert({
        name: 'Salão RLS ticket',
        slug: `rls-ticket-${marca}`,
        vertical: 'lashes',
        // A trava que `can_see_ticket` respeita. Sem ela o produto libera a visão.
        settings: { restrict_professional_view: true },
      })
      .select('id')
      .single(),
    'tenants',
  ).id

  ownerEmail = `rls-owner-${marca}@ciclo.test`
  ownerSenha = randomUUID()
  const { data: ownerData, error: ownerErr } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerSenha,
    email_confirm: true,
  })
  if (ownerErr || !ownerData.user) throw new Error(`seed falhou ao criar dono: ${ownerErr?.message}`)
  ownerUserId = ownerData.user.id
  criados.push(ownerUserId)
  exigir(
    await admin.from('memberships').insert({ tenant_id: tenantId, user_id: ownerUserId, role: 'owner' }).select('id').single(),
    'memberships owner',
  )

  const categoryId = exigir(
    await admin.from('service_categories').insert({ tenant_id: tenantId, name: 'Cílios' }).select('id').single(),
    'service_categories',
  ).id
  serviceId = exigir(
    await admin
      .from('services')
      .insert({ tenant_id: tenantId, category_id: categoryId, name: 'Volume russo', duration_min: 120, price_cents: 22000 })
      .select('id')
      .single(),
    'services',
  ).id
  clientId = exigir(
    await admin
      .from('clients')
      .insert({ tenant_id: tenantId, name: 'Cliente', phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e8)}` })
      .select('id')
      .single(),
    'clients',
  ).id

  await criarProfissional('ana', ana)
  await criarProfissional('bia', bia)
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const id of criados) await admin.auth.admin.deleteUser(id)
}, 120_000)

describe('0073 · a comanda de um profissional não vaza para outro', () => {
  it('a Bia, autenticada, NÃO enxerga a comanda da Ana pela API direta', async () => {
    const c = await entrar(bia)
    const { data, error } = await c.from('tickets').select('id, total_cents').eq('id', ana.ticketId)
    if (!error) expect(data ?? []).toEqual([])
  })

  it('a Bia NÃO enxerga os itens da comanda da Ana (comissão, custo)', async () => {
    const c = await entrar(bia)
    const { data, error } = await c
      .from('ticket_items')
      .select('id, commission_cents')
      .eq('professional_id', ana.professionalId)
    if (!error) expect(data ?? []).toEqual([])
  })

  it('a Ana continua enxergando a PRÓPRIA comanda e os próprios itens', async () => {
    const c = await entrar(ana)
    const t = await c.from('tickets').select('id').eq('id', ana.ticketId)
    expect(t.error).toBeNull()
    expect((t.data ?? []).map((r) => r.id)).toEqual([ana.ticketId])

    const i = await c.from('ticket_items').select('id').eq('id', ana.itemId)
    expect(i.error).toBeNull()
    expect((i.data ?? []).map((r) => r.id)).toEqual([ana.itemId])
  })

  it('o dono enxerga as comandas das DUAS — a trava é por profissional, não geral', async () => {
    const c = createClient(SUPABASE_URL!, ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: authErr } = await c.auth.signInWithPassword({ email: ownerEmail, password: ownerSenha })
    expect(authErr).toBeNull()

    const { data, error } = await c.from('tickets').select('id').in('id', [ana.ticketId, bia.ticketId])
    expect(error).toBeNull()
    expect(new Set((data ?? []).map((r) => r.id))).toEqual(new Set([ana.ticketId, bia.ticketId]))
  })

  it('com a trava DESLIGADA, a régua libera a Bia a ver a comanda da Ana', async () => {
    // Prova que `can_see_ticket` não é "sempre nega": é o mesmo interruptor de
    // `can_see_appointment`, e o produto o mantém desligado por padrão.
    await admin.from('tenants').update({ settings: { restrict_professional_view: false } }).eq('id', tenantId)
    try {
      const c = await entrar(bia)
      const { data, error } = await c.from('tickets').select('id').eq('id', ana.ticketId)
      expect(error).toBeNull()
      expect((data ?? []).map((r) => r.id)).toEqual([ana.ticketId])
    } finally {
      await admin.from('tenants').update({ settings: { restrict_professional_view: true } }).eq('id', tenantId)
    }
  })
})
