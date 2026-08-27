import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

/**
 * Migration 0044 (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §11): `memberships_write` deixou de ser
 * `for all` — que incluía SELECT e duplicava a avaliação de política em toda leitura de
 * `memberships`, a tabela que `contextoAtual()` consulta em toda requisição autenticada — e virou
 * três políticas (`insert`/`update`/`delete`).
 *
 * Este teste prova, com CLIENTES AUTENTICADOS DE VERDADE (nunca `service_role`, que ignora RLS e
 * não provaria nada), que a troca não abriu nem fechou nenhuma porta:
 *
 * - dono continua podendo inserir/atualizar/apagar vínculo;
 * - membro sem cargo de dono continua bloqueado nas mesmas três operações;
 * - leitura (SELECT) é idêntica para os dois, porque `memberships_select` nunca mudou.
 */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Pessoa = { userId: string; email: string; senha: string; cliente: SupabaseClient }

let tenantId: string
let dono: Pessoa
let membro: Pessoa
/** Linha de vínculo descartável — alvo de update/delete nos casos positivos e negativos. */
let membershipAlvoId: string
let terceiroUserId: string

async function criarPessoa(sufixo: string): Promise<Pessoa> {
  const marca = randomUUID().slice(0, 8)
  const email = `mw-${sufixo}-${marca}@ciclo.test`
  const senha = randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed: criar usuario ${sufixo} falhou: ${error?.message}`)
  const cliente = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password: senha })
  if (erroLogin) throw new Error(`seed: login de ${sufixo} falhou: ${erroLogin.message}`)
  return { userId: data.user.id, email, senha, cliente }
}

beforeAll(async () => {
  const { data: tenant, error: erroTenant } = await admin
    .from('tenants')
    .insert({ name: 'Tenant memberships-write', slug: `mw-${randomUUID().slice(0, 8)}`, vertical: 'lashes' })
    .select('id')
    .single()
  if (erroTenant || !tenant) throw new Error(`seed: tenant falhou: ${erroTenant?.message}`)
  tenantId = tenant.id

  dono = await criarPessoa('dono')
  membro = await criarPessoa('membro')
  const terceiro = await admin.auth.admin.createUser({ email: `mw-terceiro-${randomUUID().slice(0, 8)}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (terceiro.error || !terceiro.data.user) throw new Error('seed: terceiro falhou')
  terceiroUserId = terceiro.data.user.id

  const { error: erroDono } = await admin.from('memberships').insert({ tenant_id: tenantId, user_id: dono.userId, role: 'owner', active: true })
  if (erroDono) throw new Error(`seed: membership do dono falhou: ${erroDono.message}`)

  const { error: erroMembro } = await admin.from('memberships').insert({ tenant_id: tenantId, user_id: membro.userId, role: 'professional', active: true })
  if (erroMembro) throw new Error(`seed: membership do membro falhou: ${erroMembro.message}`)

  const { data: alvo, error: erroAlvo } = await admin
    .from('memberships')
    .insert({ tenant_id: tenantId, user_id: terceiroUserId, role: 'professional', active: true })
    .select('id')
    .single()
  if (erroAlvo || !alvo) throw new Error(`seed: membership alvo falhou: ${erroAlvo?.message}`)
  membershipAlvoId = alvo.id
})

afterAll(async () => {
  await admin.from('memberships').delete().eq('tenant_id', tenantId)
  await admin.auth.admin.deleteUser(dono.userId)
  await admin.auth.admin.deleteUser(membro.userId)
  await admin.auth.admin.deleteUser(terceiroUserId)
  await admin.from('tenants').delete().eq('id', tenantId)
})

describe('memberships_write (migration 0044 - sem SELECT duplicado)', () => {
  it('SELECT: dono e membro sem cargo de dono veem os mesmos vinculos do tenant', async () => {
    const { data: comoDono, error: e1 } = await dono.cliente.from('memberships').select('id').eq('tenant_id', tenantId)
    const { data: comoMembro, error: e2 } = await membro.cliente.from('memberships').select('id').eq('tenant_id', tenantId)
    expect(e1).toBeNull()
    expect(e2).toBeNull()
    expect(new Set(comoDono?.map((m) => m.id))).toEqual(new Set(comoMembro?.map((m) => m.id)))
    expect(comoDono?.length).toBe(3)
  })

  it('INSERT: dono consegue criar vinculo novo no proprio tenant', async () => {
    const novo = await admin.auth.admin.createUser({ email: `mw-novo-${randomUUID().slice(0, 8)}@ciclo.test`, password: randomUUID(), email_confirm: true })
    if (novo.error || !novo.data.user) throw new Error('seed do caso falhou')
    const { error } = await dono.cliente.from('memberships').insert({ tenant_id: tenantId, user_id: novo.data.user.id, role: 'professional', active: true })
    expect(error).toBeNull()
    await admin.from('memberships').delete().eq('user_id', novo.data.user.id)
    await admin.auth.admin.deleteUser(novo.data.user.id)
  })

  it('INSERT: membro sem cargo de dono e bloqueado pela RLS', async () => {
    const novo = await admin.auth.admin.createUser({ email: `mw-negado-${randomUUID().slice(0, 8)}@ciclo.test`, password: randomUUID(), email_confirm: true })
    if (novo.error || !novo.data.user) throw new Error('seed do caso falhou')
    const { error } = await membro.cliente.from('memberships').insert({ tenant_id: tenantId, user_id: novo.data.user.id, role: 'professional', active: true }).select()
    // INSERT com "with check" violado e erro real do Postgres (42501), diferente de
    // UPDATE/DELETE, que a RLS silencia como "zero linhas afetadas".
    expect(error).not.toBeNull()
    const { data: confere } = await admin.from('memberships').select('id').eq('user_id', novo.data.user.id)
    expect(confere ?? []).toHaveLength(0)
    await admin.auth.admin.deleteUser(novo.data.user.id)
  })

  it('UPDATE: dono consegue atualizar um vinculo do tenant', async () => {
    const { error } = await dono.cliente.from('memberships').update({ role: 'manager' }).eq('id', membershipAlvoId)
    expect(error).toBeNull()
    const { data: confere } = await admin.from('memberships').select('role').eq('id', membershipAlvoId).single()
    expect(confere?.role).toBe('manager')
    await admin.from('memberships').update({ role: 'professional' }).eq('id', membershipAlvoId)
  })

  it('UPDATE: membro sem cargo de dono e bloqueado pela RLS', async () => {
    const { data } = await membro.cliente.from('memberships').update({ role: 'owner' }).eq('id', membershipAlvoId).select()
    expect(data ?? []).toHaveLength(0)
    const { data: confere } = await admin.from('memberships').select('role').eq('id', membershipAlvoId).single()
    expect(confere?.role).toBe('professional')
  })

  it('DELETE: membro sem cargo de dono e bloqueado pela RLS', async () => {
    const { data } = await membro.cliente.from('memberships').delete().eq('id', membershipAlvoId).select()
    expect(data ?? []).toHaveLength(0)
    const { data: confere } = await admin.from('memberships').select('id').eq('id', membershipAlvoId).maybeSingle()
    expect(confere).not.toBeNull()
  })

  it('DELETE: dono consegue apagar um vinculo do tenant', async () => {
    const { error } = await dono.cliente.from('memberships').delete().eq('id', membershipAlvoId)
    expect(error).toBeNull()
    const { data: confere } = await admin.from('memberships').select('id').eq('id', membershipAlvoId).maybeSingle()
    expect(confere).toBeNull()
  })
})
