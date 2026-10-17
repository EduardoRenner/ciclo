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
  throw new Error('O teste do lote de importação precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

/**
 * 0128 · As travas do lote de importação (docs/103 CNV-019), que são o que faz a carga ser idempotente:
 * o mesmo arquivo não abre dois lotes vivos, a mesma linha do lote não vira duas fichas (com ou sem
 * telefone, D5), e o lote não se apaga (desfazer é estado). Asserção pelo ESTADO via admin.
 */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let email: string
let senha: string
let userId: string

beforeAll(async () => {
  const m = randomUUID().slice(0, 8)
  const t = await admin.from('tenants').insert({ name: `RLS lote ${m}`, slug: `rls-lote-${m}`, vertical: 'barber' }).select('id').single()
  if (t.error) throw new Error(`seed tenants: ${t.error.message}`)
  tenantId = t.data.id
  email = `rls-lote-${m}@ciclo.test`
  senha = randomUUID()
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !u.user) throw new Error(`seed usuário: ${error?.message}`)
  userId = u.user.id
  const mb = await admin.from('memberships').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' })
  if (mb.error) throw new Error(`seed memberships: ${mb.error.message}`)
}, 120_000)

afterAll(async () => {
  // A exclusão em cascata da conta passa com ficha ligada a lote (o SET NULL não pode barrar).
  const { error } = await admin.from('tenants').delete().eq('id', tenantId)
  await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(`a conta com lote não se apaga: ${error.message}`)
}, 120_000)

async function entrar(): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(`autenticar: ${error.message}`)
  return c
}

const lote = (hash: string) => ({ tenant_id: tenantId, file_sha256: hash, formato: 'csv', origem: 'arquivo', nivel: 'N1', counts: { lidas: 2 }, rows_expected: 2 })

describe('0128 · lote de importação', () => {
  it('o mesmo arquivo não abre dois lotes vivos; depois de desfeito, pode entrar de novo', async () => {
    const c = await entrar()
    const hash = randomUUID().replace(/-/g, '').padEnd(64, '0')
    const primeiro = await c.from('import_batches').insert(lote(hash)).select('id').single()
    expect(primeiro.error).toBeNull()
    const segundo = await c.from('import_batches').insert(lote(hash)).select('id').single()
    expect(segundo.error?.code).toBe('23505')

    const desfeito = await c.from('import_batches').update({ status: 'desfeito', undone_at: new Date().toISOString(), undone_by: userId }).eq('id', primeiro.data!.id).select('id')
    expect(desfeito.data).toHaveLength(1)
    const terceiro = await c.from('import_batches').insert(lote(hash)).select('id').single()
    expect(terceiro.error).toBeNull()
  })

  it('a mesma linha do mesmo lote não vira duas fichas, nem sem telefone (D5)', async () => {
    const c = await entrar()
    const { data: l } = await c.from('import_batches').insert(lote(randomUUID().replace(/-/g, '').padEnd(64, '1'))).select('id').single()
    const ficha = { tenant_id: tenantId, name: 'Sem Telefone', source: 'csv_import', import_batch_id: l!.id, import_row: 1 }
    expect((await c.from('clients').insert(ficha)).error).toBeNull()
    expect((await c.from('clients').insert(ficha)).error?.code).toBe('23505')
    const { count } = await admin.from('clients').select('id', { count: 'exact', head: true }).eq('import_batch_id', l!.id)
    expect(count).toBe(1)
  })

  it('o lote não se apaga pela porta lateral (desfazer é estado)', async () => {
    const c = await entrar()
    const { data: l } = await c.from('import_batches').insert(lote(randomUUID().replace(/-/g, '').padEnd(64, '2'))).select('id').single()
    await c.from('import_batches').delete().eq('id', l!.id)
    const { data } = await admin.from('import_batches').select('id').eq('id', l!.id)
    expect(data).toHaveLength(1)
  })

  it('estado incoerente é barrado no banco: desfeito sem quando, concluído sem quando', async () => {
    const c = await entrar()
    const semQuando = await c.from('import_batches').insert({ ...lote(randomUUID().replace(/-/g, '').padEnd(64, '3')), status: 'desfeito' })
    expect(semQuando.error?.code).toBe('23514')
    const concluidoSemQuando = await c.from('import_batches').insert({ ...lote(randomUUID().replace(/-/g, '').padEnd(64, '4')), status: 'concluido' })
    expect(concluidoSemQuando.error?.code).toBe('23514')
  })
})
