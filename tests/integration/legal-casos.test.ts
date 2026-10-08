import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { agirNaPendencia, criarCaso } from '@/server/advocacia/casos'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) throw new Error('legal-casos precisa das três variáveis do Supabase no .env.local.')

/**
 * docs/101 T2.1/T2.2: o serviço de casos e pendências com o cliente do USUÁRIO (a RLS vale), não
 * com a chave de serviço. É o caminho que a rota usa.
 */
const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let clientId: string
const usuarios: string[] = []
let advocacia: SupabaseClient<Database>
let estagio: SupabaseClient<Database>
let outra: SupabaseClient<Database>
const AGORA = new Date('2026-10-08T15:00:00Z') // quinta, 12:00 em Brasília
const OPCOES = { timezone: 'America/Sao_Paulo', agora: AGORA, criadoPorEstagio: false }

function id(r: { data: { id?: string } | null; error: { message: string } | null }, onde: string): string {
  if (r.error || !r.data?.id) throw new Error(`seed ${onde}: ${r.error?.message ?? 'sem id'}`)
  return r.data.id
}

async function pessoa(nome: string, legalRole: 'advogado' | 'estagio'): Promise<SupabaseClient<Database>> {
  const email = `int-legal-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed ${nome}: ${error?.message}`)
  usuarios.push(data.user.id)
  id(await admin.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: 'professional' }).select('id').single(), `membership ${nome}`)
  id(await admin.from('professionals').insert({ tenant_id: tenantId, user_id: data.user.id, display_name: nome, legal_role: legalRole }).select('id').single(), `prof ${nome}`)
  const c = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: e } = await c.auth.signInWithPassword({ email, password: senha })
  if (e) throw new Error(`login ${nome}: ${e.message}`)
  return c
}

beforeAll(async () => {
  tenantId = id(await admin.from('tenants').insert({ name: 'Escritório integração', slug: `int-legal-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single(), 'tenant')
  clientId = id(await admin.from('clients').insert({ tenant_id: tenantId, name: 'Família integração' }).select('id').single(), 'client')
  advocacia = await pessoa('advocacia', 'advogado')
  estagio = await pessoa('estagio', 'estagio')
  outra = await pessoa('outra', 'advogado')
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 120_000)

describe('criar caso', () => {
  it('holding gera as 8 pendências do modelo da plataforma, com datas em dias úteis', async () => {
    const r = await criarCaso(advocacia, tenantId, OPCOES, {
      clientId, kind: 'holding', area: 'holding_planejamento', title: 'Holding da família', clientTitle: 'o planejamento da família',
      sensitivity: 'normal', gerarChecklist: true,
    })
    expect(r.pendencias).toBe(8)
    const itens = await advocacia.from('legal_checklist_items').select('position, title, due_on, status').eq('case_id', r.id).order('position')
    expect(itens.data?.[0]).toEqual({ position: 1, title: 'Conferir quadro societário e bens', due_on: '2026-10-08', status: 'pendente' })
    // qui 08/10 + 10 dias úteis, pulando o feriado nacional de seg 12/10 (tabela de feriados da 0109)
    expect(itens.data?.find((i) => i.position === 4)?.due_on).toBe('2026-10-23')
  })

  it('caso SIGILOSO criado pela advocacia continua visível para quem criou, e só para a equipe', async () => {
    const r = await criarCaso(advocacia, tenantId, OPCOES, {
      clientId, kind: 'civel', area: 'civel', title: 'Ação reservada', clientTitle: 'o seu caso', sensitivity: 'sigiloso', gerarChecklist: false,
    })
    expect(((await advocacia.from('legal_cases').select('id').eq('id', r.id)).data ?? []).length).toBe(1)
    expect((await outra.from('legal_cases').select('id').eq('id', r.id)).data ?? []).toEqual([])
  })

  it('criminal vira sigiloso mesmo pedindo normal', async () => {
    const r = await criarCaso(advocacia, tenantId, OPCOES, {
      clientId, kind: 'outro', area: 'criminal', title: 'Defesa', clientTitle: 'o seu caso', sensitivity: 'normal', gerarChecklist: false,
    })
    const c = await advocacia.from('legal_cases').select('sensitivity').eq('id', r.id).single()
    expect(c.data?.sensitivity).toBe('sigiloso')
  })

  it('estágio gera as pendências em rascunho', async () => {
    const r = await criarCaso(estagio, tenantId, { ...OPCOES, criadoPorEstagio: true }, {
      clientId, kind: 'divorcio_partilha', area: 'familia_sucessoes', title: 'Divórcio', clientTitle: 'o seu divórcio', sensitivity: 'normal', gerarChecklist: true,
    })
    const itens = await estagio.from('legal_checklist_items').select('status').eq('case_id', r.id)
    expect((itens.data ?? []).length).toBe(3)
    expect((itens.data ?? []).every((i) => i.status === 'rascunho')).toBe(true)
  })

  it('cliente de outro escritório é recusado com mensagem, não com erro interno', async () => {
    const outroTenant = id(await admin.from('tenants').insert({ name: 'Outro', slug: `int-legal-x-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single(), 'outro tenant')
    const clienteAlheio = id(await admin.from('clients').insert({ tenant_id: outroTenant, name: 'Alheio' }).select('id').single(), 'cliente alheio')
    await expect(
      criarCaso(advocacia, tenantId, OPCOES, { clientId: clienteAlheio, kind: 'outro', area: 'outro', title: 'x caso', clientTitle: 'x caso', sensitivity: 'normal', gerarChecklist: false }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    await admin.from('tenants').delete().eq('id', outroTenant)
  })
})

describe('agir numa pendência', () => {
  let item: { id: string; row_version: number }

  beforeAll(async () => {
    const r = await criarCaso(advocacia, tenantId, OPCOES, {
      clientId, kind: 'societario', area: 'empresarial', title: 'Alteração', clientTitle: 'a alteração da empresa', sensitivity: 'normal', gerarChecklist: true,
    })
    const i = await advocacia.from('legal_checklist_items').select('id, row_version').eq('case_id', r.id).eq('position', 1).single()
    item = i.data!
  })

  it('receber, devolver com motivo (rodada 2) e a versão sobe a cada passo', async () => {
    const quem = { userId: usuarios[0]!, timezone: 'America/Sao_Paulo', agora: AGORA }
    const r1 = await agirNaPendencia(advocacia, tenantId, item.id, quem, { acao: 'receber', rowVersion: item.row_version })
    expect(r1).toMatchObject({ estado: 'recebido', rodada: 1 })
    const r2 = await agirNaPendencia(advocacia, tenantId, item.id, quem, { acao: 'devolver', motivo: 'Contrato sem a última alteração', rowVersion: item.row_version + 1 })
    expect(r2).toMatchObject({ estado: 'devolvido', rodada: 2 })
  })

  it('versão velha é conflito (409), e não sobrescreve', async () => {
    const quem = { userId: usuarios[0]!, timezone: 'America/Sao_Paulo', agora: AGORA }
    await expect(agirNaPendencia(advocacia, tenantId, item.id, quem, { acao: 'receber', rowVersion: item.row_version })).rejects.toBeInstanceOf(AppError)
    const atual = await advocacia.from('legal_checklist_items').select('status').eq('id', item.id).single()
    expect(atual.data?.status).toBe('devolvido')
  })

  it('pendência de caso sigiloso que a pessoa não alcança responde como inexistente', async () => {
    const s = await criarCaso(advocacia, tenantId, OPCOES, {
      clientId, kind: 'holding', area: 'holding_planejamento', title: 'Holding reservada', clientTitle: 'o planejamento', sensitivity: 'sigiloso', gerarChecklist: true,
    })
    const i = (await advocacia.from('legal_checklist_items').select('id, row_version').eq('case_id', s.id).limit(1).single()).data!
    await expect(
      agirNaPendencia(outra, tenantId, i.id, { userId: 'x', timezone: 'America/Sao_Paulo', agora: AGORA }, { acao: 'receber', rowVersion: i.row_version }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
