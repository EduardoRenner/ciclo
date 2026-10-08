import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { salvarConfigAdvocacia } from '@/server/advocacia/configuracao'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/** docs/101 T4.6: só a direção confirma regras e muda OAB; o `settings` de outras telas não se perde. */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
let T: string
let profId: string
const usuarios: string[] = []
let dono: SupabaseClient<Database>
let advocacia: SupabaseClient<Database>

async function pessoa(papel: 'owner' | 'professional'): Promise<SupabaseClient<Database>> {
  const email = `int-cfg-${papel}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user!.id, role: papel })
  const p = await admin.from('professionals').insert({ tenant_id: T, user_id: u.data.user!.id, display_name: papel, legal_role: 'advogado' }).select('id').single()
  if (papel === 'professional') profId = p.data!.id
  const c = createClient<Database>(BANCO, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: senha })
  return c
}

beforeAll(async () => {
  T = (await admin.from('tenants').insert({ name: 'Config', slug: `int-cfg-${randomUUID().slice(0, 8)}`, vertical: 'general', settings: { site: { accent: '#123456' } } }).select('id').single()).data!.id
  dono = await pessoa('owner')
  advocacia = await pessoa('professional')
}, 120_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 60_000)

describe('configurações do pacote', () => {
  it('a direção confirma regras sem apagar o resto do settings', async () => {
    const r = await salvarConfigAdvocacia(dono, T, { regrasConfirmadas: ['unidade-civel', 'unidade-trabalhista'] })
    expect(r.regras).toEqual(['unidade-civel', 'unidade-trabalhista'])
    const s = (await admin.from('tenants').select('settings').eq('id', T).single()).data!.settings as Record<string, unknown>
    expect(s).toEqual({ site: { accent: '#123456' }, advocacia: { regras_confirmadas: ['unidade-civel', 'unidade-trabalhista'] } })
  })

  it('a advocacia não confirma regra (a política de tenants é de dono)', async () => {
    await expect(salvarConfigAdvocacia(advocacia, T, { regrasConfirmadas: [] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const s = (await admin.from('tenants').select('settings').eq('id', T).single()).data!.settings as { advocacia: { regras_confirmadas: string[] } }
    expect(s.advocacia.regras_confirmadas).toHaveLength(2)
  })

  it('a direção grava OAB e papel; OAB pela metade é recusada', async () => {
    await salvarConfigAdvocacia(dono, T, { equipe: { professionalId: profId, oabNumero: '12345', oabUf: 'SC', papel: 'advogado' } })
    const p = (await admin.from('professionals').select('oab_number, oab_uf').eq('id', profId).single()).data!
    expect(p).toEqual({ oab_number: '12345', oab_uf: 'SC' })
    await expect(salvarConfigAdvocacia(dono, T, { equipe: { professionalId: profId, oabNumero: '1', oabUf: null, papel: 'advogado' } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })
})
