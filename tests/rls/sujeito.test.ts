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
  throw new Error('O teste do sujeito precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

/**
 * 0132 · o sujeito do ciclo (AUT-101, `docs/105-ciclo/C-021`). Asserção pelo ESTADO via admin:
 * - RLS: o dono de um salão não vê o carro de outro;
 * - chave composta: nem o admin (que passa por cima da RLS) consegue ligar um agendamento do salão A ao
 *   carro do salão B — a FK exige o mesmo tenant;
 * - sem DELETE para o dono; placa única entre os ATIVOS;
 * - remoção física do cliente leva os sujeitos e deixa o agendamento com `subject_id` nulo (o agendamento
 *   nunca é apagado). A eliminação LGPD anonimiza em vez de apagar: coberta em tests/integration/lgpd.test.ts.
 */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Salao = { tenantId: string; clientId: string; professionalId: string; serviceId: string }
let a: Salao
let b: Salao
let email: string
let senha: string
let userId: string

/** Só o `id` da linha criada interessa aos testes; seed que falha para aqui com o motivo. */
function ok(r: { data: unknown; error: { message: string } | null }, o: string): { id: string } {
  if (r.error || !r.data) throw new Error(`seed ${o}: ${r.error?.message}`)
  return r.data as { id: string }
}

async function salao(m: string, letra: string): Promise<Salao> {
  const t = ok(await admin.from('tenants').insert({ name: `RLS sujeito ${letra} ${m}`, slug: `rls-sujeito-${letra}-${m}`, vertical: 'barber' }).select('id').single(), 'tenants')
  const cat = ok(await admin.from('service_categories').insert({ tenant_id: t.id, name: 'Banho' }).select('id').single(), 'categoria')
  const p = ok(await admin.from('professionals').insert({ tenant_id: t.id, display_name: `Prof ${letra}` }).select('id').single(), 'profissional')
  const s = ok(
    await admin.from('services').insert({ tenant_id: t.id, category_id: cat.id, name: 'Banho', duration_min: 60, price_cents: 6000 }).select('id').single(),
    'serviço',
  )
  const c = ok(
    await admin
      .from('clients')
      .insert({ tenant_id: t.id, name: `Tutor ${letra}`, phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e8)}` })
      .select('id')
      .single(),
    'cliente',
  )
  return { tenantId: t.id, clientId: c.id, professionalId: p.id, serviceId: s.id }
}

beforeAll(async () => {
  const m = randomUUID().slice(0, 8)
  a = await salao(m, 'a')
  b = await salao(m, 'b')
  email = `rls-sujeito-${m}@ciclo.test`
  senha = randomUUID()
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !u.user) throw new Error(`seed usuário: ${error?.message}`)
  userId = u.user.id
  ok(await admin.from('memberships').insert({ tenant_id: a.tenantId, user_id: userId, role: 'owner' }).select('user_id').single(), 'membership')
}, 120_000)

afterAll(async () => {
  await admin.from('tenants').delete().in('id', [a.tenantId, b.tenantId])
  await admin.auth.admin.deleteUser(userId)
}, 120_000)

async function entrar(): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(`autenticar: ${error.message}`)
  return c
}

let horario = 0
const agendamento = (s: Salao, subjectId: string | null) => {
  // Cada agendamento num dia diferente: a trava anti-sobreposição (appointments_no_overlap) é por profissional.
  const inicio = new Date(Date.now() + 86_400_000 * (1 + horario++))
  return {
    tenant_id: s.tenantId,
    client_id: s.clientId,
    professional_id: s.professionalId,
    service_id: s.serviceId,
    starts_at: inicio.toISOString(),
    ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
    subject_id: subjectId,
  }
}

describe('0132 · o sujeito do ciclo', () => {
  it('RLS: o dono do salão A vê o animal dele e não vê o do salão B', async () => {
    const meu = ok(await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'animal', name: 'Mel' }).select('id').single(), 'sujeito A')
    const outro = ok(await admin.from('subjects').insert({ tenant_id: b.tenantId, client_id: b.clientId, kind: 'animal', name: 'Thor' }).select('id').single(), 'sujeito B')
    const c = await entrar()
    const { data, error } = await c.from('subjects').select('id')
    expect(error).toBeNull()
    const ids = (data ?? []).map((x) => x.id)
    expect(ids).toContain(meu.id)
    expect(ids).not.toContain(outro.id)
  })

  it('chave composta: nem o admin liga um agendamento do salão A ao carro do salão B', async () => {
    const carroB = ok(
      await admin.from('subjects').insert({ tenant_id: b.tenantId, client_id: b.clientId, kind: 'veiculo', name: 'Onix', identifier: 'ABC1D23' }).select('id').single(),
      'carro B',
    )
    const cruzado = await admin.from('appointments').insert(agendamento(a, carroB.id)).select('id')
    expect(cruzado.error?.code).toBe('23503')

    const carroA = ok(
      await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'veiculo', name: 'Gol', identifier: 'XYZ9A87' }).select('id').single(),
      'carro A',
    )
    const certo = await admin.from('appointments').insert(agendamento(a, carroA.id)).select('id, subject_id').single()
    expect(certo.error).toBeNull()
    expect(certo.data?.subject_id).toBe(carroA.id)
  })

  it('o dono não apaga um sujeito: quem saiu vira inativo', async () => {
    const s = ok(await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'animal', name: 'Luna' }).select('id').single(), 'Luna')
    const c = await entrar()
    await c.from('subjects').delete().eq('id', s.id)
    const ainda = await admin.from('subjects').select('id').eq('id', s.id)
    expect(ainda.data).toHaveLength(1)
    const inativa = await c.from('subjects').update({ active: false }).eq('id', s.id).select('active').single()
    expect(inativa.data?.active).toBe(false)
  })

  it('a mesma placa não é dois carros ativos no mesmo salão; inativo libera', async () => {
    const placa = `QWE${Math.floor(1000 + Math.random() * 8999)}`
    const primeiro = ok(
      await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'veiculo', name: 'Uno', identifier: placa }).select('id').single(),
      'Uno',
    )
    const repetido = await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'veiculo', name: 'Uno 2', identifier: placa })
    expect(repetido.error?.code).toBe('23505')
    await admin.from('subjects').update({ active: false }).eq('id', primeiro.id)
    const depois = await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'veiculo', name: 'Uno novo dono', identifier: placa })
    expect(depois.error).toBeNull()
  })

  it('remoção FÍSICA do cliente leva os sujeitos e mantém o agendamento, com subject_id nulo (a eliminação LGPD anonimiza; ver lgpd.test)', async () => {
    const c = ok(
      await admin
        .from('clients')
        .insert({ tenant_id: a.tenantId, name: 'Some Daqui', phone_e164: `+5511${Math.floor(1e8 + Math.random() * 9e8)}` })
        .select('id')
        .single(),
      'cliente LGPD',
    )
    const s = ok(await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: c.id, kind: 'animal', name: 'Bolt' }).select('id').single(), 'Bolt')
    const ag = ok(await admin.from('appointments').insert({ ...agendamento(a, s.id), client_id: c.id }).select('id').single(), 'agendamento LGPD')
    const apagou = await admin.from('clients').delete().eq('id', c.id)
    expect(apagou.error).toBeNull()
    expect((await admin.from('subjects').select('id').eq('id', s.id)).data).toHaveLength(0)
    const sobrou = await admin.from('appointments').select('id, subject_id, tenant_id').eq('id', ag.id).single()
    expect(sobrou.data?.subject_id).toBeNull()
    expect(sobrou.data?.tenant_id).toBe(a.tenantId)
  })

  it('leitura de km (0141): o dono grava e lê a dele, não vê a do outro salão, e não edita nem apaga o histórico', async () => {
    const carroA = ok(await admin.from('subjects').insert({ tenant_id: a.tenantId, client_id: a.clientId, kind: 'veiculo', name: 'HB20' }).select('id').single(), 'HB20')
    const carroB = ok(await admin.from('subjects').insert({ tenant_id: b.tenantId, client_id: b.clientId, kind: 'veiculo', name: 'Kwid' }).select('id').single(), 'Kwid')
    ok(await admin.from('odometer_readings').insert({ tenant_id: b.tenantId, subject_id: carroB.id, read_on: '2026-09-01', km: 9_000 }).select('id').single(), 'km B')
    const c = await entrar()

    // controle positivo: o mesmo cliente autenticado CONSEGUE gravar — o resto não passa por cegueira
    const minha = ok(await c.from('odometer_readings').insert({ tenant_id: a.tenantId, subject_id: carroA.id, read_on: '2026-09-01', km: 41_300 }).select('id').single(), 'km A')
    const visiveis = await c.from('odometer_readings').select('subject_id').in('subject_id', [carroA.id, carroB.id])
    expect(visiveis.data?.map((l) => l.subject_id)).toEqual([carroA.id])

    const editou = await c.from('odometer_readings').update({ km: 1 }).eq('id', minha.id).select('km')
    expect(editou.error?.code).toBe('42501')
    await c.from('odometer_readings').delete().eq('id', minha.id)
    const ficou = await admin.from('odometer_readings').select('km').eq('id', minha.id).single()
    expect(ficou.data?.km).toBe(41_300)
  })
})
