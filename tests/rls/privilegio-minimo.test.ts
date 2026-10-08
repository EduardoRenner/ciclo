import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * docs/102 M0.3 (migration 0117): privilégio mínimo no schema `public`.
 *
 * A estrutura sai do CATÁLOGO (`privilegios_report()`), não de uma lista: tabela criada amanhã entra no
 * relatório sozinha e reprova aqui se nascer com `anon`, com TRUNCATE ou com DELETE sem política.
 * O comportamento prova o efeito com o cliente de verdade, e o controle positivo prova que o DELETE não
 * foi tirado de todo mundo (a dona ainda apaga folga, que tem política de DELETE).
 */
type Linha = { table_name: string; anon_qualquer: boolean; auth_truncate: boolean; auth_delete: boolean; politica_de_delete: boolean }

const relatorio = await admin.rpc('privilegios_report')
if (relatorio.error) throw new Error(`privilegios_report falhou: ${relatorio.error.message}`)
const linhas = (relatorio.data ?? []) as Linha[]

describe('estrutura: privilégio mínimo em toda tabela', () => {
  it('o relatório enxerga a base (piso pelo positivo conhecido)', () => {
    const nomes = linhas.map((l) => l.table_name)
    for (const conhecida of ['appointments', 'audit_log', 'clients', 'stock_moves', 'time_off']) expect(nomes).toContain(conhecida)
    expect(linhas.length).toBeGreaterThanOrEqual(59)
    expect(linhas.some((l) => l.politica_de_delete), 'nenhuma tabela com política de DELETE: o detector parou de ver').toBe(true)
  })

  it('nenhuma tabela dá privilégio a anon', () => {
    expect(linhas.filter((l) => l.anon_qualquer).map((l) => l.table_name)).toEqual([])
  })

  it('nenhuma tabela dá TRUNCATE a authenticated', () => {
    expect(linhas.filter((l) => l.auth_truncate).map((l) => l.table_name)).toEqual([])
  })

  it('DELETE para authenticated só onde há política de DELETE', () => {
    expect(linhas.filter((l) => l.auth_delete && !l.politica_de_delete).map((l) => l.table_name)).toEqual([])
  })
})

let T: string
let dona: SupabaseClient
let userId: string

beforeAll(async () => {
  const t = await admin.from('tenants').insert({ name: 'Privilégio', slug: `rls-priv-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single()
  if (t.error) throw new Error(t.error.message)
  T = t.data.id
  const email = `rls-priv-${randomUUID().slice(0, 6)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (u.error || !u.data.user) throw new Error(u.error?.message)
  userId = u.data.user.id
  const m = await admin.from('memberships').insert({ tenant_id: T, user_id: userId, role: 'owner' })
  if (m.error) throw new Error(m.error.message)
  dona = createClient(URL_BANCO, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const l = await dona.auth.signInWithPassword({ email, password: senha })
  if (l.error) throw new Error(l.error.message)
}, 60_000)

afterAll(async () => {
  await admin.from('time_off').delete().eq('tenant_id', T)
  await admin.from('tenants').delete().eq('id', T)
  await admin.auth.admin.deleteUser(userId)
}, 60_000)

describe('comportamento', () => {
  it('a dona não apaga agendamento: é privilégio negado, não "0 linhas"', async () => {
    const r = await dona.from('appointments').delete().eq('tenant_id', T).select('id')
    expect(r.error?.message ?? '').toMatch(/permission denied/)
  })

  it('anon não lê tabela nenhuma pela API', async () => {
    const anon = createClient(URL_BANCO, ANON, { auth: { persistSession: false } })
    const r = await anon.from('clients').select('id').limit(1)
    expect(r.error?.message ?? '').toMatch(/permission denied/)
  })

  it('controle positivo: a dona ainda apaga a própria folga (há política de DELETE)', async () => {
    const f = await admin.from('time_off').insert({ tenant_id: T, starts_at: '2026-12-24T12:00:00Z', ends_at: '2026-12-24T22:00:00Z', reason: 'Teste' }).select('id').single()
    if (f.error) throw new Error(f.error.message)
    const r = await dona.from('time_off').delete().eq('id', f.data.id).select('id')
    expect(r.error).toBeNull()
    expect(r.data).toHaveLength(1)
  })
})
