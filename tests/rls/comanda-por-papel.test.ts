import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Falta de credencial não vira verde: o que este arquivo guarda é o isolamento de comandas.
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste de comanda por papel precisa das chaves do Supabase local no .env.local.')
}

/**
 * APR-029: quem vê cada comanda e cada item, por papel. As políticas de leitura de `tickets` e
 * `ticket_items` passaram de `can_see_ticket(tenant_id, professional_id)` por LINHA para os conjuntos
 * da APR-028, calculados uma vez por consulta. Escrito e visto VERDE contra a política antiga antes
 * da troca. O financeiro de uma profissional não vaza para a colega (0073), e o caso da pessoa que é
 * profissional em dois negócios está aqui pelo mesmo motivo do teste de agendamentos.
 */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Pessoa = { email: string; senha: string; userId: string; db?: SupabaseClient }
const criados: string[] = []
const tenants: string[] = []

async function pessoa(nome: string): Promise<Pessoa> {
  const email = `rls-comanda-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou ao criar ${nome}: ${error?.message}`)
  criados.push(data.user.id)
  return { email, senha, userId: data.user.id }
}

async function entrar(p: Pessoa): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email: p.email, password: p.senha })
  if (error) throw new Error(`não consegui autenticar ${p.email}: ${error.message}`)
  return c
}

async function id(r: PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>, onde: string) {
  const { data, error } = await r
  if (error || !data) throw new Error(`seed falhou em ${onde}: ${error?.message}`)
  return data.id
}

async function negocio(nome: string, restrito: boolean) {
  const marca = randomUUID().slice(0, 8)
  const t = await id(admin.from('tenants').insert({ name: nome, slug: `rls-comanda-${marca}`, vertical: 'barber', settings: { restrict_professional_view: restrito } }).select('id').single(), 'tenants')
  tenants.push(t)
  const categoria = await id(admin.from('service_categories').insert({ tenant_id: t, name: 'Corte' }).select('id').single(), 'categoria')
  const servico = await id(admin.from('services').insert({ tenant_id: t, category_id: categoria, name: 'Corte', duration_min: 30, price_cents: 5000 }).select('id').single(), 'servico')
  return { t, servico }
}

async function membro(t: string, p: Pessoa, role: 'owner' | 'manager' | 'professional' | 'reception' | 'finance') {
  await id(admin.from('memberships').insert({ tenant_id: t, user_id: p.userId, role }).select('id').single(), `membership ${role}`)
}

async function profissional(t: string, p: Pessoa | null, nome: string) {
  return id(admin.from('professionals').insert({ tenant_id: t, user_id: p?.userId ?? null, display_name: nome }).select('id').single(), `professional ${nome}`)
}

const itemDe = new Map<string, string>()
async function comanda(t: string, servico: string, professionalId: string | null) {
  const ticket = await id(admin.from('tickets').insert({ tenant_id: t, professional_id: professionalId, total_cents: 5_000 }).select('id').single(), 'ticket')
  const item = await id(
    admin
      .from('ticket_items')
      .insert({ tenant_id: t, ticket_id: ticket, service_id: servico, professional_id: professionalId, description: 'Corte', unit_price_cents: 5_000, total_cents: 5_000, commission_cents: 2_000 })
      .select('id')
      .single(),
    'ticket_item',
  )
  itemDe.set(ticket, item)
  return ticket
}

/** Comandas visíveis — e confere que os ITENS visíveis são exatamente os dessas comandas. */
const visiveis = async (db: SupabaseClient, ids: string[]) => {
  const comandas = ((await db.from('tickets').select('id').in('id', ids)).data ?? []).map((r) => r.id).sort()
  const itens = ((await db.from('ticket_items').select('id').in('id', ids.map((t) => itemDe.get(t)!))).data ?? []).map((r) => r.id).sort()
  expect(itens, 'item visível sem a comanda (ou o contrário)').toEqual(comandas.map((t) => itemDe.get(t)!).sort())
  return comandas
}

// Negócio A: restrito. Negócio B: restrito, onde a Ana também é profissional. Negócio C: aberto.
const A = { ids: [] as string[] } as { t: string; servico: string; ids: string[]; daAna: string; daBia: string; semLogin: string; balcao: string }
const B = { ids: [] as string[] } as { t: string; servico: string; ids: string[]; daAnaEmB: string; comIdDaAnaEmA: string }
const C = { ids: [] as string[] } as { t: string; servico: string; ids: string[] }
let dono: Pessoa, gerente: Pessoa, recepcao: Pessoa, financeiro: Pessoa, ana: Pessoa, bia: Pessoa, estranho: Pessoa, inativa: Pessoa

beforeAll(async () => {
  const [p0, p1, p2, p3, p4, p5, p6, p7] = await Promise.all(['dono', 'gerente', 'recepcao', 'financeiro', 'ana', 'bia', 'estranho', 'inativa'].map((n) => pessoa(n)))
  ;[dono, gerente, recepcao, financeiro, ana, bia, estranho, inativa] = [p0!, p1!, p2!, p3!, p4!, p5!, p6!, p7!]

  Object.assign(A, await negocio('Comanda A', true))
  await membro(A.t, dono, 'owner')
  await membro(A.t, gerente, 'manager')
  await membro(A.t, recepcao, 'reception')
  await membro(A.t, financeiro, 'finance')
  await membro(A.t, ana, 'professional')
  await membro(A.t, bia, 'professional')
  await membro(A.t, inativa, 'owner')
  await admin.from('memberships').update({ active: false }).eq('tenant_id', A.t).eq('user_id', inativa.userId)
  const anaEmA = await profissional(A.t, ana, 'Ana')
  const biaEmA = await profissional(A.t, bia, 'Bia')
  const semLoginEmA = await profissional(A.t, null, 'Cadeira 3')
  A.daAna = await comanda(A.t, A.servico, anaEmA)
  A.daBia = await comanda(A.t, A.servico, biaEmA)
  A.semLogin = await comanda(A.t, A.servico, semLoginEmA)
  A.balcao = await comanda(A.t, A.servico, null)
  A.ids = [A.daAna, A.daBia, A.semLogin, A.balcao]

  Object.assign(B, await negocio('Comanda B', true))
  await membro(B.t, ana, 'professional')
  const anaEmB = await profissional(B.t, ana, 'Ana em B')
  B.daAnaEmB = await comanda(B.t, B.servico, anaEmB)
  B.comIdDaAnaEmA = await comanda(B.t, B.servico, anaEmA)
  B.ids = [B.daAnaEmB, B.comIdDaAnaEmA]

  Object.assign(C, await negocio('Comanda C', false))
  await membro(C.t, bia, 'professional')
  const outroEmC = await profissional(C.t, null, 'Outro em C')
  C.ids = [await comanda(C.t, C.servico, outroEmC)]

  for (const p of [dono, gerente, recepcao, financeiro, ana, bia, estranho, inativa]) p.db = await entrar(p)
}, 180_000)

afterAll(async () => {
  for (const t of tenants) await admin.from('tenants').delete().eq('id', t)
  for (const u of criados) await admin.auth.admin.deleteUser(u)
}, 120_000)

describe('quem vê cada comanda e cada item, por papel (APR-029)', () => {
  it('controle positivo: o dono vê as quatro comandas do negócio, inclusive a da cadeira sem login e a venda de balcão', async () => {
    expect(await visiveis(dono.db!, A.ids)).toEqual([...A.ids].sort())
  })

  it('gerente, recepção e financeiro veem tudo do negócio, mesmo com a visão restrita', async () => {
    for (const p of [gerente, recepcao, financeiro]) expect(await visiveis(p.db!, A.ids)).toEqual([...A.ids].sort())
  })

  it('com a visão restrita, a profissional vê só as dela — nem a venda de balcão, sem profissional', async () => {
    expect(await visiveis(ana.db!, A.ids)).toEqual([A.daAna])
    expect(await visiveis(bia.db!, A.ids)).toEqual([A.daBia])
  })

  it('profissional em dois negócios: em B vê a dela de B, e NÃO a que aponta para o id dela de A', async () => {
    expect(await visiveis(ana.db!, B.ids)).toEqual([B.daAnaEmB])
  })

  it('com a visão aberta, a profissional vê todas do negócio', async () => {
    expect(await visiveis(bia.db!, C.ids)).toEqual(C.ids)
  })

  it('quem não é do negócio, quem foi desativado e quem não entrou veem zero', async () => {
    const todos = [...A.ids, ...B.ids, ...C.ids]
    expect(await visiveis(estranho.db!, todos)).toEqual([])
    expect(await visiveis(inativa.db!, todos)).toEqual([])
    const anonimo = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
    // Sem `grant` para `anon` (0117): a recusa vem antes da política, como 42501 — e nunca com linha.
    const r = await anonimo.from('tickets').select('id').in('id', todos)
    expect(r.data ?? []).toEqual([])
    if (r.error) expect(r.error.code).toBe('42501')
  })
})
