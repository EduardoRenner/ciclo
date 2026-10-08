import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { montarEstrutura } from '@/core/advocacia/estrutura-da-familia'
import { lerEstrutura } from '@/server/advocacia/estrutura'
import { criarEmpresa, criarPessoa, registrarAto } from '@/server/advocacia/estrutura-escrita'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/** docs/101 T2.1/T3.1: pessoa, empresa e ato societário, e a história que o ato deixa. */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
let T: string
let clienteId: string
const usuarios: string[] = []
let adv: SupabaseClient<Database>
let advUid: string
let financeiro: SupabaseClient<Database>
let finUid: string

async function pessoa(papel: 'professional' | 'finance'): Promise<{ c: SupabaseClient<Database>; uid: string }> {
  const email = `int-estr-${papel}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user!.id, role: papel })
  const c = createClient<Database>(BANCO, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: senha })
  return { c, uid: u.data.user!.id }
}

beforeAll(async () => {
  T = (await admin.from('tenants').insert({ name: 'Estrutura', slug: `int-estr-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single()).data!.id
  clienteId = (await admin.from('clients').insert({ tenant_id: T, name: 'Família Teste' }).select('id').single()).data!.id
  const a = await pessoa('professional')
  adv = a.c
  advUid = a.uid
  const f = await pessoa('finance')
  financeiro = f.c
  finUid = f.uid
}, 120_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 60_000)

describe('cadastro da estrutura', () => {
  it('constituição e depois alteração: o quadro novo vale hoje, o antigo continua na data dele', async () => {
    const pai = await criarPessoa(adv, T, advUid, { clientId: clienteId, fullName: 'Pai Exemplo', relationship: 'titular', maritalRegime: 'nao_informado' })
    const mae = await criarPessoa(adv, T, advUid, { clientId: clienteId, fullName: 'Mãe Exemplo', relationship: 'conjuge', maritalRegime: 'comunhao_parcial' })
    const filho = await criarPessoa(adv, T, advUid, { clientId: clienteId, fullName: 'Filho Exemplo', relationship: 'filho_filha', maritalRegime: 'nao_informado' })
    const h = await criarEmpresa(adv, T, { clientId: clienteId, legalName: 'Holding Exemplo', kind: 'holding_patrimonial' })

    await registrarAto(adv, T, h.id, {
      effectiveOn: '2025-01-10',
      kind: 'constituicao',
      substituirQuadro: true,
      novoQuadro: [
        { dono: `person:${pai.id}`, percent: 50 },
        { dono: `person:${mae.id}`, percent: 50 },
      ],
    })
    const alt = await registrarAto(adv, T, h.id, {
      effectiveOn: '2026-03-01',
      kind: 'doacao_quotas',
      substituirQuadro: true,
      novoQuadro: [
        { dono: `person:${pai.id}`, percent: 40 },
        { dono: `person:${mae.id}`, percent: 40 },
        { dono: `person:${filho.id}`, percent: 20, usufrutoDe: pai.id },
      ],
    })
    expect(alt.fechadas).toBe(2)

    const hoje = await lerEstrutura(adv, T, clienteId, '2026-10-08')
    const antes = await lerEstrutura(adv, T, clienteId, '2025-06-01')
    const mHoje = montarEstrutura(hoje!.pessoas, hoje!.empresas, hoje!.arestas)
    const mAntes = montarEstrutura(antes!.pessoas, antes!.empresas, antes!.arestas)
    expect(mHoje.empresas[0]!.donos.map((d) => [d.nome, d.percent, d.usufruto])).toEqual([
      ['Pai Exemplo', 40, null],
      ['Mãe Exemplo', 40, null],
      ['Filho Exemplo', 20, 'Pai Exemplo'],
    ])
    expect(mAntes.empresas[0]!.donos.map((d) => d.percent)).toEqual([50, 50])
    expect(hoje!.datas).toEqual(['2025-01-10', '2026-03-01'])
  })

  it('empresa dona de si mesma é recusada antes do banco', async () => {
    const e = await criarEmpresa(adv, T, { clientId: clienteId, legalName: 'Operacional Exemplo', kind: 'operacional' })
    await expect(
      registrarAto(adv, T, e.id, { effectiveOn: '2026-01-01', kind: 'constituicao', substituirQuadro: true, novoQuadro: [{ dono: `entity:${e.id}`, percent: 100 }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('o financeiro não cadastra na estrutura (política)', async () => {
    await expect(criarPessoa(financeiro, T, finUid, { clientId: clienteId, fullName: 'Intruso', relationship: 'outro', maritalRegime: 'nao_informado' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
})
