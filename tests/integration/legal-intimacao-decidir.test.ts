import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { decidirIntimacao } from '@/server/advocacia/intimacoes'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * docs/101 T4.2: a decisão da triagem pela RPC `legal_intimacao_decidir` (0112), com o cliente do
 * USUÁRIO. A intimação não tem política de escrita: se esta porta falhar aberta, qualquer um muda o
 * estado do que o tribunal publicou.
 */
let T: string
let clientId: string
let caseId: string
let sigilosoId: string
const usuarios: string[] = []
let advocacia: SupabaseClient<Database>
let estagio: SupabaseClient<Database>
let secretaria: SupabaseClient<Database>
let outra: SupabaseClient<Database>
let seq = Math.floor(Math.random() * 1e9)

function id(r: { data: { id?: string } | null; error: { message: string } | null }, onde: string): string {
  if (r.error || !r.data?.id) throw new Error(`seed ${onde}: ${r.error?.message ?? 'sem id'}`)
  return r.data.id
}

async function pessoa(nome: string, papel: 'professional' | 'reception', legal: 'advogado' | 'estagio' | null): Promise<SupabaseClient<Database>> {
  const email = `int-intim-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (u.error || !u.data.user) throw new Error(u.error?.message)
  usuarios.push(u.data.user.id)
  id(await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user.id, role: papel }).select('id').single(), 'membership')
  id(await admin.from('professionals').insert({ tenant_id: T, user_id: u.data.user.id, display_name: nome, legal_role: legal }).select('id').single(), 'prof')
  const c = createClient<Database>(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const e = await c.auth.signInWithPassword({ email, password: senha })
  if (e.error) throw new Error(e.error.message)
  return c
}

async function intimacao(caso: string | null = null): Promise<string> {
  return id(
    await admin
      .from('legal_intimations')
      .insert({
        tenant_id: T,
        djen_id: ++seq,
        numero_processo: '00000010120268240001'.slice(0, 13) + String(seq).padStart(7, '0').slice(-7),
        data_disponibilizacao: '2026-10-07',
        tribunal: 'TJSC',
        texto_sanitizado: 'Prazo de 15 (quinze) dias. Exemplo fictício.',
        alvo: 'OAB 1/SC',
        case_id: caso,
        status: caso ? 'vinculada' : 'nova',
      })
      .select('id')
      .single(),
    'intimação',
  )
}

beforeAll(async () => {
  T = id(await admin.from('tenants').insert({ name: 'Triagem', slug: `int-intim-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single(), 'tenant')
  clientId = id(await admin.from('clients').insert({ tenant_id: T, name: 'Cliente triagem' }).select('id').single(), 'cliente')
  caseId = id(await admin.from('legal_cases').insert({ tenant_id: T, client_id: clientId, kind: 'civel', title: 'Ação', client_title: 'o seu processo' }).select('id').single(), 'caso')
  sigilosoId = id(
    await admin.from('legal_cases').insert({ tenant_id: T, client_id: clientId, kind: 'civel', title: 'Reservada', client_title: 'o seu processo', sensitivity: 'sigiloso' }).select('id').single(),
    'sigiloso',
  )
  advocacia = await pessoa('advocacia', 'professional', 'advogado')
  estagio = await pessoa('estagio', 'professional', 'estagio')
  secretaria = await pessoa('secretaria', 'reception', null)
  outra = await pessoa('outra', 'professional', 'advogado')
}, 180_000)

afterAll(async () => {
  await admin.from('legal_deadlines').delete().eq('tenant_id', T)
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 120_000)

describe('decidir a intimação', () => {
  it('criar prazo grava o prazo fatal confirmado, com a sugestão e a divergência', async () => {
    const i = await intimacao()
    await admin.from('legal_intimation_suggestions').insert({ tenant_id: T, intimation_id: i, suggested_due_on: '2026-10-29', internal_due_on: '2026-10-27', calc_memo: { regra: '15 dias úteis' }, calc_rule_version: 'cpc-219-v1' })
    const r = await decidirIntimacao(advocacia, i, { acao: 'criar_prazo', caseId, dueOn: '2026-10-28', internalDueOn: '2026-10-26' })
    expect(r).toMatchObject({ status: 'prazo_criado', confirmado: true })
    const p = (await admin.from('legal_deadlines').select('kind, source, due_on, suggested_due_on, calc_divergence, confirmed_at').eq('intimation_id', i).single()).data!
    expect(p).toMatchObject({ kind: 'fatal', source: 'djen', due_on: '2026-10-28', suggested_due_on: '2026-10-29', calc_divergence: true })
    expect(p.confirmed_at).not.toBeNull()
    const de = (await admin.from('legal_intimations').select('status, triaged_by').eq('id', i).single()).data!
    expect(de.status).toBe('prazo_criado')
    expect(de.triaged_by).not.toBeNull()
  })

  it('estágio cria o prazo sem confirmação', async () => {
    const i = await intimacao()
    const r = await decidirIntimacao(estagio, i, { acao: 'criar_prazo', caseId, dueOn: '2026-11-03' })
    expect(r).toMatchObject({ status: 'prazo_criado', confirmado: false })
  })

  it('decidida não se decide de novo', async () => {
    const i = await intimacao()
    await decidirIntimacao(advocacia, i, { acao: 'descartar', motivo: 'OAB homônima de outro escritório' })
    await expect(decidirIntimacao(advocacia, i, { acao: 'sem_prazo', motivo: 'Mera ciência das partes' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('sem motivo não descarta', async () => {
    const i = await intimacao()
    await expect(decidirIntimacao(advocacia, i, { acao: 'descartar', motivo: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('secretaria não decide', async () => {
    const i = await intimacao()
    await expect(decidirIntimacao(secretaria, i, { acao: 'descartar', motivo: 'Não é do escritório' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('caso sigiloso fora do alcance responde como inexistente, nos dois sentidos', async () => {
    const i = await intimacao()
    await expect(decidirIntimacao(outra, i, { acao: 'vincular', caseId: sigilosoId })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const j = await intimacao(sigilosoId)
    await expect(decidirIntimacao(outra, j, { acao: 'descartar', motivo: 'Tentativa de mexer' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await admin.from('legal_intimations').select('status').eq('id', j).single()).data!.status).toBe('vinculada')
  })

  it('UPDATE direto continua sem porta', async () => {
    const i = await intimacao()
    const r = await advocacia.from('legal_intimations').update({ status: 'descartada' }).eq('id', i).select('id')
    expect(r.data ?? []).toEqual([])
    expect((await admin.from('legal_intimations').select('status').eq('id', i).single()).data!.status).toBe('nova')
  })
})
