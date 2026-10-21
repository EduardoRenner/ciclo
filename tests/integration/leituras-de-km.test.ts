import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { exigirVeiculoNoAlcance, listarLeiturasDeKm, registrarLeituraDeKm } from '@/server/services/leituras-de-km'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('O teste de km precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const tenants: string[] = []
const usuarios: string[] = []

async function oficina(nome: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `km-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: nome, vertical: 'nails', slug: `km-${marca}`, timezone: 'America/Sao_Paulo' })
  tenants.push(tenant.id)
  const cliente = await svc.from('clients').insert({ tenant_id: tenant.id, name: 'Motorista' }).select('id').single()
  if (cliente.error) throw new Error(cliente.error.message)
  return { tenantId: tenant.id, userId: data.user.id, clientId: cliente.data.id }
}

async function carro(o: { tenantId: string; clientId: string }, placa: string, active = true) {
  const s = await svc.from('subjects').insert({ tenant_id: o.tenantId, client_id: o.clientId, kind: 'veiculo', name: 'Onix 2021', identifier: placa, active }).select('id').single()
  if (s.error) throw new Error(s.error.message)
  return s.data.id
}

let a: Awaited<ReturnType<typeof oficina>>
let b: Awaited<ReturnType<typeof oficina>>

beforeAll(async () => {
  a = await oficina('Oficina A')
  b = await oficina('Oficina B')
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('leitura de km no check-in (AUT-103, C-039)', () => {
  it('primeira e seguinte normais: gravam sem aviso, a lista vem da mais nova para a mais velha', async () => {
    const id = await carro(a, 'ABC1D23')
    expect(await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 41_300, readOn: '2026-01-10' })).toMatchObject({ gravada: true, flag: null })
    expect(await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 52_100, readOn: '2026-07-10' })).toMatchObject({ gravada: true, flag: null })
    const lista = await listarLeiturasDeKm(svc, a.tenantId, id)
    expect(lista.map((l) => l.km)).toEqual([52_100, 41_300])
  })

  it('km que DESCE: devolve o aviso e NÃO grava; confirmado, grava com a marca "desce"', async () => {
    const id = await carro(a, 'DEF2G34')
    await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 80_000, readOn: '2026-03-01' })
    const sem = await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 12_000, readOn: '2026-09-01' })
    expect(sem).toMatchObject({ gravada: false, precisaConfirmar: true, tipo: 'desce' })
    expect(sem.gravada === false && sem.aviso).toContain('Trocou o painel?')
    expect(await listarLeiturasDeKm(svc, a.tenantId, id)).toHaveLength(1)

    const com = await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 12_000, readOn: '2026-09-01', confirmado: true })
    expect(com).toMatchObject({ gravada: true, flag: 'desce' })
    expect((await listarLeiturasDeKm(svc, a.tenantId, id))[0]).toMatchObject({ km: 12_000, flag: 'desce' })
  })

  it('zero a mais (salto absurdo): pede conferência antes de gravar', async () => {
    const id = await carro(a, 'GHI3J45')
    await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 41_300, readOn: '2026-08-01' })
    const r = await registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 413_000, readOn: '2026-09-01' })
    expect(r).toMatchObject({ gravada: false, precisaConfirmar: true, tipo: 'salto' })
  })

  it('veículo de OUTRA oficina: não acha, não grava', async () => {
    const deB = await carro(b, 'KLM4N56')
    await expect(registrarLeituraDeKm(svc, a.tenantId, a.userId, deB, { km: 1_000, readOn: '2026-09-01' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const { count } = await svc.from('odometer_readings').select('id', { count: 'exact', head: true }).eq('subject_id', deB)
    expect(count).toBe(0)
  })

  it('veículo vendido (inativo): recusa e explica o que fazer', async () => {
    const id = await carro(a, 'OPQ5R67', false)
    await expect(registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 1_000, readOn: '2026-09-01' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('visita de OUTRA oficina: a chave composta recusa (não dá para pendurar km em agendamento alheio)', async () => {
    const id = await carro(a, 'STU6V78')
    const prof = await svc.from('professionals').select('id').eq('tenant_id', b.tenantId).limit(1).single()
    const serv = await svc.from('services').select('id').eq('tenant_id', b.tenantId).limit(1).single()
    if (prof.error || serv.error) throw new Error('o onboarding da oficina B não criou profissional/serviço')
    const ag = await svc
      .from('appointments')
      .insert({ tenant_id: b.tenantId, client_id: b.clientId, professional_id: prof.data.id, service_id: serv.data.id, starts_at: '2026-09-01T12:00:00Z', ends_at: '2026-09-01T13:00:00Z' })
      .select('id')
      .single()
    if (ag.error) throw new Error(ag.error.message)
    await expect(registrarLeituraDeKm(svc, a.tenantId, a.userId, id, { km: 1_000, readOn: '2026-09-01', appointmentId: ag.data.id })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(await listarLeiturasDeKm(svc, a.tenantId, id)).toHaveLength(0)
  })

  it('alcance own (APR-040): sem atender o dono do carro, o profissional não alcança; dono/recepção (all) alcançam', async () => {
    const id = await carro(a, 'WXY7Z89')
    await expect(exigirVeiculoNoAlcance(svc, a.tenantId, id, 'all')).resolves.toBeUndefined()
    // o cliente de serviço não é profissional de ninguém: `my_professional_id` dá nulo, como o de quem não atende
    await expect(exigirVeiculoNoAlcance(svc, a.tenantId, id, 'own')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
