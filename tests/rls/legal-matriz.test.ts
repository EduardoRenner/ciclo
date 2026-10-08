import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const URL_BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const admin = createClient(URL_BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * docs/101 T1.11 e anexo 05 §4: a matriz PAPEL × TABELA × OPERAÇÃO do pacote Advocacia, escrita como
 * tabela de resultados esperados. Uma linha da matriz que mudar sem a tabela mudar junto reprova.
 *
 * O cenário: um caso normal (N) e um sigiloso (S, equipe = `adv_equipe`), cada um com pendência,
 * intimação e prazo; e uma intimação e um prazo SEM caso. As contagens esperadas saem dessas sete
 * linhas, então todo "0" tem um "N > 0" de outro papel na mesma linha (controle positivo).
 */
type Persona = 'dono' | 'gerencia' | 'adv_equipe' | 'adv_fora' | 'estagio' | 'secretaria' | 'financeiro'
const PERSONAS: { nome: Persona; papel: string; legal: 'advogado' | 'estagio' | null }[] = [
  { nome: 'dono', papel: 'owner', legal: 'advogado' },
  { nome: 'gerencia', papel: 'manager', legal: 'advogado' },
  { nome: 'adv_equipe', papel: 'professional', legal: 'advogado' },
  { nome: 'adv_fora', papel: 'professional', legal: 'advogado' },
  { nome: 'estagio', papel: 'professional', legal: 'estagio' },
  { nome: 'secretaria', papel: 'reception', legal: null },
  { nome: 'financeiro', papel: 'finance', legal: null },
]

/** Quantas linhas do cenário cada papel enxerga, por tabela. */
const LEITURA: Record<string, Record<Persona, number>> = {
  legal_cases: { dono: 2, gerencia: 2, adv_equipe: 2, adv_fora: 1, estagio: 1, secretaria: 1, financeiro: 0 },
  legal_checklist_items: { dono: 2, gerencia: 2, adv_equipe: 2, adv_fora: 1, estagio: 1, secretaria: 1, financeiro: 0 },
  // sem caso: só direção e advocacia; com caso: quem enxerga o caso
  legal_intimations: { dono: 3, gerencia: 3, adv_equipe: 3, adv_fora: 2, estagio: 2, secretaria: 1, financeiro: 0 },
  // sugestões da intimação sem caso e da intimação do caso sigiloso
  legal_intimation_suggestions: { dono: 2, gerencia: 2, adv_equipe: 2, adv_fora: 1, estagio: 1, secretaria: 0, financeiro: 0 },
  // sem caso: todos menos o financeiro; com caso: quem enxerga o caso
  legal_deadlines: { dono: 3, gerencia: 3, adv_equipe: 3, adv_fora: 2, estagio: 2, secretaria: 2, financeiro: 0 },
  legal_intimation_sync: { dono: 1, gerencia: 1, adv_equipe: 0, adv_fora: 0, estagio: 0, secretaria: 0, financeiro: 0 },
  legal_access_log: { dono: 0, gerencia: 0, adv_equipe: 0, adv_fora: 0, estagio: 0, secretaria: 0, financeiro: 0 },
}

/** Quem consegue INSERIR: feriado do escritório e prazo FATAL sem caso. */
const ESCRITA: Record<string, Record<Persona, boolean>> = {
  legal_holidays: { dono: true, gerencia: true, adv_equipe: false, adv_fora: false, estagio: false, secretaria: false, financeiro: false },
  prazo_fatal: { dono: true, gerencia: true, adv_equipe: true, adv_fora: true, estagio: true, secretaria: false, financeiro: false },
}

let T: string
let clienteId: string
const ids: Record<string, string> = {}
const quem = {} as Record<Persona, { cliente: SupabaseClient; prof: string }>
const usuarios: string[] = []
let djen = Math.floor(Math.random() * 1e9) + 7e9

function id(r: { data: { id?: string } | null; error: { message: string } | null }, onde: string): string {
  if (r.error || !r.data?.id) throw new Error(`seed ${onde}: ${r.error?.message ?? 'sem id'}`)
  return r.data.id
}

beforeAll(async () => {
  T = id(await admin.from('tenants').insert({ name: 'Matriz', slug: `rls-matriz-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single(), 'tenant')
  clienteId = id(await admin.from('clients').insert({ tenant_id: T, name: 'Cliente da matriz' }).select('id').single(), 'cliente')
  for (const p of PERSONAS) {
    const email = `rls-matriz-${p.nome}-${randomUUID().slice(0, 6)}@ciclo.test`
    const senha = randomUUID()
    const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
    if (u.error || !u.data.user) throw new Error(u.error?.message)
    usuarios.push(u.data.user.id)
    id(await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user.id, role: p.papel }).select('id').single(), `membership ${p.nome}`)
    const prof = id(await admin.from('professionals').insert({ tenant_id: T, user_id: u.data.user.id, display_name: p.nome, legal_role: p.legal }).select('id').single(), `prof ${p.nome}`)
    const c = createClient(URL_BANCO, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const l = await c.auth.signInWithPassword({ email, password: senha })
    if (l.error) throw new Error(l.error.message)
    quem[p.nome] = { cliente: c, prof }
  }
  ids.N = id(await admin.from('legal_cases').insert({ tenant_id: T, client_id: clienteId, kind: 'civel', title: 'Normal', client_title: 'o processo' }).select('id').single(), 'caso N')
  ids.S = id(
    await admin.from('legal_cases').insert({ tenant_id: T, client_id: clienteId, kind: 'civel', title: 'Sigiloso', client_title: 'o processo', sensitivity: 'sigiloso' }).select('id').single(),
    'caso S',
  )
  await admin.from('legal_case_members').insert({ tenant_id: T, case_id: ids.S, professional_id: quem.adv_equipe.prof })
  for (const c of ['N', 'S']) {
    await admin.from('legal_checklist_items').insert({ tenant_id: T, case_id: ids[c], title: `Item ${c}`, kind: 'enviar_documento', owed_by: 'cliente' })
    await admin.from('legal_deadlines').insert({ tenant_id: T, client_id: clienteId, case_id: ids[c], kind: 'interno', title: `Prazo ${c}`, due_on: '2026-11-10' })
  }
  await admin.from('legal_deadlines').insert({ tenant_id: T, client_id: clienteId, kind: 'interno', title: 'Prazo sem caso', due_on: '2026-11-10' })
  const intim = async (caso: string | null) =>
    id(
      await admin
        .from('legal_intimations')
        .insert({
          tenant_id: T,
          djen_id: ++djen,
          numero_processo: String(djen).padStart(20, '0'),
          data_disponibilizacao: '2026-10-07',
          tribunal: 'TJSC',
          texto_sanitizado: 'Exemplo fictício.',
          alvo: 'oab:12345/SC',
          case_id: caso,
          status: caso ? 'vinculada' : 'nova',
        })
        .select('id')
        .single(),
      'intimação',
    )
  ids.I0 = await intim(null)
  ids.IN = await intim(ids.N!)
  ids.IS = await intim(ids.S!)
  for (const i of [ids.I0, ids.IS]) await admin.from('legal_intimation_suggestions').insert({ tenant_id: T, intimation_id: i, sem_sugestao: 'Teste.' })
  await admin.from('legal_intimation_sync').insert({ tenant_id: T, alvo: 'oab:12345/SC', dia: '2026-10-07', count_fonte: 3, count_gravado: 3, ok: true })
  await admin.from('legal_access_log').insert({ tenant_id: T, kind: 'open_case', case_id: ids.S })
}, 240_000)

afterAll(async () => {
  await admin.from('legal_deadlines').delete().eq('tenant_id', T)
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 120_000)

describe('matriz de leitura', () => {
  it('o cenário foi montado (a service role vê tudo)', async () => {
    for (const [tabela, n] of [['legal_cases', 2], ['legal_intimations', 3], ['legal_deadlines', 3], ['legal_access_log', 1]] as const) {
      const r = await admin.from(tabela).select('id', { count: 'exact', head: true }).eq('tenant_id', T)
      expect(r.count, tabela).toBe(n)
    }
  })

  for (const [tabela, esperado] of Object.entries(LEITURA)) {
    it(`${tabela}`, async () => {
      const obtido = {} as Record<Persona, number>
      for (const p of PERSONAS) {
        const r = await quem[p.nome].cliente.from(tabela).select('tenant_id').eq('tenant_id', T)
        obtido[p.nome] = r.error ? 0 : (r.data ?? []).length
      }
      expect(obtido).toEqual(esperado)
    })
  }
})

describe('matriz de escrita', () => {
  it('feriado do escritório: só direção e gerência', async () => {
    const obtido = {} as Record<Persona, boolean>
    for (const p of PERSONAS) {
      const r = await quem[p.nome].cliente
        .from('legal_holidays')
        .insert({ tenant_id: T, day: `2026-12-${String(PERSONAS.indexOf(p) + 1).padStart(2, '0')}`, scope: 'municipal', name: `Feriado ${p.nome}` })
      obtido[p.nome] = !r.error
    }
    expect(obtido).toEqual(ESCRITA.legal_holidays)
  })

  it('prazo FATAL sem caso: direção, gerência e quem é professional; nunca secretaria nem financeiro', async () => {
    const obtido = {} as Record<Persona, boolean>
    for (const p of PERSONAS) {
      const r = await quem[p.nome].cliente
        .from('legal_deadlines')
        .insert({ tenant_id: T, client_id: clienteId, kind: 'fatal', title: `Fatal ${p.nome}`, due_on: '2026-11-20' })
      obtido[p.nome] = !r.error
    }
    expect(obtido).toEqual(ESCRITA.prazo_fatal)
  })

  it('ninguém apaga linha jurídica, nem a direção', async () => {
    for (const p of PERSONAS) {
      for (const tabela of ['legal_cases', 'legal_checklist_items', 'legal_deadlines', 'legal_intimations', 'legal_access_log']) {
        const r = await quem[p.nome].cliente.from(tabela).delete().eq('tenant_id', T).select('id')
        if (!r.error) expect(r.data ?? [], `${p.nome} apagou em ${tabela}`).toEqual([])
      }
    }
    const casos = await admin.from('legal_cases').select('id', { count: 'exact', head: true }).eq('tenant_id', T)
    expect(casos.count).toBe(2)
  })

  it('0115: DELETE nem chega à RLS: é privilégio negado para todo papel (não "0 linhas")', async () => {
    for (const p of PERSONAS) {
      const r = await quem[p.nome].cliente.from('legal_cases').delete().eq('tenant_id', T).select('id')
      expect(r.error?.message ?? '', p.nome).toMatch(/permission denied/)
    }
  })

  it('0115: a trilha e o histórico não aceitam INSERT de ninguém pela API', async () => {
    const r = await quem.dono.cliente.from('legal_access_log').insert({ tenant_id: T, kind: 'open_case', case_id: ids.N })
    expect(r.error?.message ?? '').toMatch(/permission denied/)
  })

  it('ninguém muda o estado da intimação por UPDATE direto (só pela RPC da decisão)', async () => {
    for (const p of PERSONAS) {
      const r = await quem[p.nome].cliente.from('legal_intimations').update({ status: 'descartada' }).eq('id', ids.I0!).select('id')
      if (!r.error) expect(r.data ?? [], p.nome).toEqual([])
    }
    expect((await admin.from('legal_intimations').select('status').eq('id', ids.I0!).single()).data!.status).toBe('nova')
  })
})
