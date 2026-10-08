import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { alterarPrazo, criarPrazo, encerrarPrazo } from '@/server/advocacia/prazos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/** docs/101 T4: as ações de prazo pela tela, contra as regras do banco (0109). */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
let T: string
let clienteId: string
const usuarios: string[] = []
const P = {} as Record<'advocacia' | 'estagio' | 'secretaria', { c: SupabaseClient<Database>; uid: string }>

async function pessoa(nome: 'advocacia' | 'estagio' | 'secretaria', papel: 'professional' | 'reception', legal: 'advogado' | 'estagio' | null) {
  const email = `int-prz-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user!.id, role: papel })
  await admin.from('professionals').insert({ tenant_id: T, user_id: u.data.user!.id, display_name: nome, legal_role: legal })
  const c = createClient<Database>(BANCO, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: senha })
  P[nome] = { c, uid: u.data.user!.id }
}

beforeAll(async () => {
  T = (await admin.from('tenants').insert({ name: 'Prazos', slug: `int-prz-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single()).data!.id
  clienteId = (await admin.from('clients').insert({ tenant_id: T, name: 'Cliente dos prazos' }).select('id').single()).data!.id
  await pessoa('advocacia', 'professional', 'advogado')
  await pessoa('estagio', 'professional', 'estagio')
  await pessoa('secretaria', 'reception', null)
}, 120_000)

afterAll(async () => {
  await admin.from('legal_deadlines').delete().eq('tenant_id', T)
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 60_000)

const fatal = { kind: 'fatal' as const, title: 'Contestação', dueOn: '2026-11-20', internalDueOn: '2026-11-18' }

describe('ações de prazo', () => {
  it('a advocacia cria prazo fatal já confirmado; o do estágio nasce sem confirmação e só a advocacia confirma', async () => {
    const a = await criarPrazo(P.advocacia.c, T, P.advocacia.uid, { clientId: clienteId, ...fatal })
    expect((await admin.from('legal_deadlines').select('confirmed_at').eq('id', a.id).single()).data!.confirmed_at).not.toBeNull()
    const e = await criarPrazo(P.estagio.c, T, P.estagio.uid, { clientId: clienteId, ...fatal })
    expect((await admin.from('legal_deadlines').select('confirmed_at').eq('id', e.id).single()).data!.confirmed_at).toBeNull()
    await expect(alterarPrazo(P.estagio.c, T, e.id, P.estagio.uid, { acao: 'confirmar' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // a mesma recusa no banco (0114): UPDATE direto pela API, com o token do estágio, não passa
    const direto = await P.estagio.c.from('legal_deadlines').update({ confirmed_by: P.estagio.uid, confirmed_at: new Date().toISOString() }).eq('id', e.id).select('id')
    expect(direto.error?.message ?? '').toContain('estágio')
    await alterarPrazo(P.advocacia.c, T, e.id, P.advocacia.uid, { acao: 'confirmar' })
    expect((await admin.from('legal_deadlines').select('confirmed_at').eq('id', e.id).single()).data!.confirmed_at).not.toBeNull()
  })

  it('secretaria não cria prazo fatal (política), mas cria prazo interno', async () => {
    await expect(criarPrazo(P.secretaria.c, T, P.secretaria.uid, { clientId: clienteId, ...fatal })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(criarPrazo(P.secretaria.c, T, P.secretaria.uid, { clientId: clienteId, kind: 'interno', title: 'Ligar para o cartório', dueOn: '2026-11-10' })).resolves.toHaveProperty('id')
  })

  it('antecipar o fatal com motivo vai para o histórico; adiar é recusado com a frase do banco', async () => {
    const p = await criarPrazo(P.advocacia.c, T, P.advocacia.uid, { clientId: clienteId, ...fatal })
    await alterarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { acao: 'corrigir', dueOn: '2026-11-19', motivo: 'Feriado municipal não estava no calendário' })
    const hist = await admin.from('legal_deadline_changes').select('field, old_value, new_value, reason').eq('deadline_id', p.id)
    expect(hist.data).toContainEqual({ field: 'due_on', old_value: '2026-11-20', new_value: '2026-11-19', reason: 'Feriado municipal não estava no calendário' })
    await expect(alterarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { acao: 'corrigir', dueOn: '2026-11-25', motivo: 'Tentando empurrar o prazo' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('não pode ser adiado'),
    })
  })

  it('corrigir para a mesma data é recusado (antes respondia "corrigida" e o motivo sumia)', async () => {
    const p = await criarPrazo(P.advocacia.c, T, P.advocacia.uid, { clientId: clienteId, ...fatal })
    await expect(alterarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { acao: 'corrigir', dueOn: fatal.dueOn, motivo: 'Nada mudou de verdade' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: { dueOn: expect.stringContaining('já é a data') } },
    })
    const hist = await admin.from('legal_deadline_changes').select('id', { count: 'exact', head: true }).eq('deadline_id', p.id)
    expect(hist.count).toBe(0)
    // controle positivo: mesma data e o interno mudando é correção de verdade
    await expect(alterarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { acao: 'corrigir', dueOn: fatal.dueOn, internalDueOn: '2026-11-16', motivo: 'Margem interna maior' })).resolves.toHaveProperty('id')
  })

  it('cumprido de prazo fatal exige nota; encerrar duas vezes é conflito', async () => {
    const p = await criarPrazo(P.advocacia.c, T, P.advocacia.uid, { clientId: clienteId, ...fatal })
    await expect(encerrarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { status: 'cumprido' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'Para registrar como cumprido, anexe o protocolo ou escreva a nota.',
    })
    expect(await encerrarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { status: 'cumprido', nota: 'Protocolo 12345 de exemplo' })).toEqual({ status: 'cumprido' })
    await expect(encerrarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { status: 'cancelado', motivo: 'Por engano' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('perdido sem motivo é recusado com a frase', async () => {
    const p = await criarPrazo(P.advocacia.c, T, P.advocacia.uid, { clientId: clienteId, kind: 'interno', title: 'Revisar minuta', dueOn: '2026-11-05' })
    await expect(encerrarPrazo(P.advocacia.c, T, p.id, P.advocacia.uid, { status: 'perdido' })).rejects.toMatchObject({ message: 'Escreva o motivo (pelo menos 5 letras).' })
  })
})
