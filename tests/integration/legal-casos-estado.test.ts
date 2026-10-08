import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mudarCaso } from '@/server/advocacia/casos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/** docs/101 T2.6: estado, frase ao cliente e sigilo do caso, com o cliente do usuário. */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
let T: string
let clienteId: string
const usuarios: string[] = []
let dono: SupabaseClient<Database>
let advocacia: SupabaseClient<Database>
const HOJE = '2026-10-08'
const quem = (papel: 'owner' | 'professional') => ({ papel, escritorio: 'Escritório Teste', hoje: HOJE })

async function pessoa(papel: 'owner' | 'professional'): Promise<SupabaseClient<Database>> {
  const email = `int-est-${papel}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user!.id, role: papel })
  await admin.from('professionals').insert({ tenant_id: T, user_id: u.data.user!.id, display_name: papel, legal_role: 'advogado' })
  const c = createClient<Database>(BANCO, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: senha })
  return c
}

async function caso(extra: Record<string, unknown> = {}): Promise<{ id: string; rv: number }> {
  const r = await admin
    .from('legal_cases')
    .insert({ tenant_id: T, client_id: clienteId, kind: 'holding', title: 'Holding teste', client_title: 'o planejamento da família', ...extra })
    .select('id, row_version')
    .single()
  return { id: r.data!.id, rv: r.data!.row_version }
}

beforeAll(async () => {
  T = (await admin.from('tenants').insert({ name: 'Estado', slug: `int-est-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single()).data!.id
  clienteId = (await admin.from('clients').insert({ tenant_id: T, name: 'Ana Souza', phone_e164: '+5548999990001' }).select('id').single()).data!.id
  dono = await pessoa('owner')
  advocacia = await pessoa('professional')
}, 120_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 60_000)

describe('mudar o caso', () => {
  it('concluir grava a data e a frase vira mensagem pronta para o WhatsApp do cliente', async () => {
    const c = await caso()
    const r = await mudarCaso(advocacia, T, c.id, quem('professional'), { estado: 'concluido', notaParaCliente: 'o contrato social foi registrado.', rowVersion: c.rv })
    expect(r.estado).toBe('concluido')
    expect(r.mensagem).toMatchObject({ texto: expect.stringContaining('Oi, Ana!'), link: expect.stringMatching(/^https:\/\/wa\.me\/5548999990001\?text=/) })
    const linha = (await admin.from('legal_cases').select('closed_on, client_status_note').eq('id', c.id).single()).data!
    expect(linha).toEqual({ closed_on: HOJE, client_status_note: 'o contrato social foi registrado.' })
  })

  it('transição que não existe é recusada; versão velha é conflito', async () => {
    const c = await caso({ status: 'arquivado', closed_on: HOJE })
    await expect(mudarCaso(advocacia, T, c.id, quem('professional'), { estado: 'em_andamento', rowVersion: c.rv })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    const d = await caso()
    await expect(mudarCaso(advocacia, T, d.id, quem('professional'), { estado: 'em_andamento', rowVersion: d.rv + 3 })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('frase com número de processo não vira mensagem: volta o motivo', async () => {
    const c = await caso()
    const r = await mudarCaso(advocacia, T, c.id, quem('professional'), { notaParaCliente: 'saiu decisão no 0001234-56.2026.8.24.0001', rowVersion: c.rv })
    expect(r.mensagem).toMatchObject({ erro: expect.stringContaining('número de processo') })
  })

  it('tirar o sigilo: só a direção e com motivo; área criminal nunca', async () => {
    const c = await caso({ sensitivity: 'sigiloso' })
    await expect(mudarCaso(advocacia, T, c.id, quem('professional'), { sigilo: 'normal', motivoDoSigilo: 'cliente autorizou', rowVersion: c.rv })).rejects.toMatchObject({
      code: expect.stringMatching(/VALIDATION_ERROR|NOT_FOUND/),
    })
    await expect(mudarCaso(dono, T, c.id, quem('owner'), { sigilo: 'normal', rowVersion: c.rv })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect((await mudarCaso(dono, T, c.id, quem('owner'), { sigilo: 'normal', motivoDoSigilo: 'Cliente autorizou por escrito', rowVersion: c.rv })).estado).toBe('aberto')
    const crim = await caso({ area: 'criminal', sensitivity: 'sigiloso' })
    await expect(mudarCaso(dono, T, crim.id, quem('owner'), { sigilo: 'normal', motivoDoSigilo: 'Cliente autorizou por escrito', rowVersion: crim.rv })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    })
  })
})
