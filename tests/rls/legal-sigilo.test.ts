import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste de sigilo do pacote Advocacia precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

/**
 * docs/101 anexo 02 A3/A4 e anexo 05 §3: dentro do MESMO escritório, quem vê o quê. O isolamento
 * entre escritórios é do `isolation.test.ts`; aqui é a segunda fronteira (papel e equipe do caso).
 *
 * Toda asserção de "não vê" vem com o controle positivo ao lado (alguém vê a mesma linha): sem ele,
 * um seed que não criou o caso faria o "não vê" passar vazio.
 */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Pessoa = { email: string; senha: string; userId: string; professionalId: string | null; cliente: SupabaseClient }
type Papel = 'owner' | 'manager' | 'professional' | 'reception' | 'finance'

let tenantId: string
let clientId: string
let casoNormal: string
let casoSigiloso: string
let entidade: string
let pessoaTitular: string
let atoConstituicao: string
let participacao: string
const usuarios: string[] = []
const P: Record<'dono' | 'membro' | 'outra' | 'recepcao' | 'financeiro', Pessoa> = {} as never

function exigir<T extends { id?: string }>(r: { data: T | null; error: { message: string } | null }, onde: string): { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return { id: r.data.id }
}

async function criarPessoa(nome: string, papel: Papel, comProfissional: boolean): Promise<Pessoa> {
  const email = `rls-legal-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou ao criar ${nome}: ${error?.message}`)
  usuarios.push(data.user.id)
  exigir(await admin.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: papel }).select('id').single(), `membership ${nome}`)
  const professionalId = comProfissional
    ? exigir(await admin.from('professionals').insert({ tenant_id: tenantId, user_id: data.user.id, display_name: nome }).select('id').single(), `professional ${nome}`).id
    : null
  const cliente = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password: senha })
  if (erroLogin) throw new Error(`login de ${nome} falhou: ${erroLogin.message}`)
  return { email, senha, userId: data.user.id, professionalId, cliente }
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  tenantId = exigir(await admin.from('tenants').insert({ name: 'Escritório de teste', slug: `rls-legal-${marca}`, vertical: 'general' }).select('id').single(), 'tenant').id
  clientId = exigir(await admin.from('clients').insert({ tenant_id: tenantId, name: 'Família de teste' }).select('id').single(), 'client').id

  P.dono = await criarPessoa('dono', 'owner', true)
  P.membro = await criarPessoa('membro', 'professional', true)
  P.outra = await criarPessoa('outra', 'professional', true)
  P.recepcao = await criarPessoa('recepcao', 'reception', false)
  P.financeiro = await criarPessoa('financeiro', 'finance', false)

  casoNormal = exigir(
    await admin.from('legal_cases').insert({ tenant_id: tenantId, client_id: clientId, kind: 'holding', title: 'Holding da família', client_title: 'Seu planejamento' }).select('id').single(),
    'caso normal',
  ).id
  casoSigiloso = exigir(
    await admin
      .from('legal_cases')
      .insert({ tenant_id: tenantId, client_id: clientId, kind: 'civel', title: 'Caso reservado', client_title: 'Seu caso', sensitivity: 'sigiloso' })
      .select('id')
      .single(),
    'caso sigiloso',
  ).id
  exigir(
    await admin.from('legal_case_members').insert({ tenant_id: tenantId, case_id: casoSigiloso, professional_id: P.membro.professionalId }).select('case_id').single().then((r) => ({ ...r, data: r.data ? { id: r.data.case_id } : null })),
    'membro do sigiloso',
  )
  entidade = exigir(await admin.from('legal_entities').insert({ tenant_id: tenantId, client_id: clientId, kind: 'holding_patrimonial', legal_name: 'Holding Teste' }).select('id').single(), 'entidade').id
  pessoaTitular = exigir(await admin.from('legal_persons').insert({ tenant_id: tenantId, client_id: clientId, full_name: 'Titular Teste' }).select('id').single(), 'pessoa').id
  atoConstituicao = exigir(
    await admin.from('legal_corporate_changes').insert({ tenant_id: tenantId, entity_id: entidade, effective_on: '2026-01-01', kind: 'constituicao' }).select('id').single(),
    'ato',
  ).id
  participacao = exigir(
    await admin
      .from('legal_ownerships')
      .insert({ tenant_id: tenantId, owned_entity_id: entidade, owner_person_id: pessoaTitular, percent: 100, valid_from: '2026-01-01', opened_by_change_id: atoConstituicao })
      .select('id')
      .single(),
    'participação',
  ).id
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 120_000)

async function ve(p: Pessoa, caso: string): Promise<boolean> {
  const { data, error } = await p.cliente.from('legal_cases').select('id').eq('id', caso)
  if (error) return false
  return (data ?? []).length === 1
}

describe('caso sigiloso: só a direção e a equipe do caso', () => {
  it('controle positivo: a direção e o membro veem o sigiloso', async () => {
    expect(await ve(P.dono, casoSigiloso)).toBe(true)
    expect(await ve(P.membro, casoSigiloso)).toBe(true)
  })

  it('advocacia fora da equipe e secretaria não veem o sigiloso, mas veem o normal', async () => {
    expect(await ve(P.outra, casoSigiloso)).toBe(false)
    expect(await ve(P.recepcao, casoSigiloso)).toBe(false)
    expect(await ve(P.outra, casoNormal)).toBe(true)
    expect(await ve(P.recepcao, casoNormal)).toBe(true)
  })

  it('a contagem de restritos devolve só o número, e é 1 para quem não alcança o sigiloso', async () => {
    const { data, error } = await P.outra.cliente.rpc('legal_count_restricted', { p_tenant: tenantId })
    expect(error).toBeNull()
    expect(data).toBe(1)
    const { data: doDono } = await P.dono.cliente.rpc('legal_count_restricted', { p_tenant: tenantId })
    expect(doDono).toBe(0)
  })

  it('pendência do caso sigiloso herda o sigilo', async () => {
    exigir(
      await admin.from('legal_checklist_items').insert({ tenant_id: tenantId, case_id: casoSigiloso, title: 'Documento reservado', kind: 'enviar_documento', owed_by: 'cliente' }).select('id').single(),
      'pendência sigilosa',
    )
    const doMembro = await P.membro.cliente.from('legal_checklist_items').select('id').eq('case_id', casoSigiloso)
    const daOutra = await P.outra.cliente.from('legal_checklist_items').select('id').eq('case_id', casoSigiloso)
    expect((doMembro.data ?? []).length).toBe(1)
    expect(daOutra.data ?? []).toEqual([])
  })
})

describe('o papel financeiro não lê o jurídico', () => {
  it('nem caso normal, nem pessoas, nem empresas', async () => {
    expect(await ve(P.financeiro, casoNormal)).toBe(false)
    for (const tabela of ['legal_persons', 'legal_entities', 'legal_ownerships'] as const) {
      const { data } = await P.financeiro.cliente.from(tabela).select('id').eq('tenant_id', tenantId)
      expect(data ?? [], tabela).toEqual([])
      // controle positivo: a direção vê a mesma tabela
      const { data: doDono } = await P.dono.cliente.from(tabela).select('id').eq('tenant_id', tenantId)
      expect((doDono ?? []).length, `${tabela} vazia para a direção: o seed não montou o cenário`).toBeGreaterThan(0)
    }
  })
})

describe('regras de sigilo no banco', () => {
  it('caso criminal nasce sigiloso mesmo pedindo normal', async () => {
    const { data, error } = await P.dono.cliente
      .from('legal_cases')
      .insert({ tenant_id: tenantId, client_id: clientId, kind: 'outro', area: 'criminal', title: 'Defesa', client_title: 'Seu caso', sensitivity: 'normal' })
      .select('sensitivity')
      .single()
    expect(error).toBeNull()
    expect(data?.sensitivity).toBe('sigiloso')
  })

  it('advocacia não tira o sigilo; a direção tira, com motivo', async () => {
    const semPapel = await P.membro.cliente.from('legal_cases').update({ sensitivity: 'normal', sensitivity_reason: 'liberado pelo cliente' }).eq('id', casoSigiloso).select('id')
    expect(semPapel.error?.message ?? '').toMatch(/Só a direção/)
    const semMotivo = await P.dono.cliente.from('legal_cases').update({ sensitivity: 'normal' }).eq('id', casoSigiloso).select('id')
    expect(semMotivo.error?.message ?? '').toMatch(/motivo/)
    const certo = await P.dono.cliente.from('legal_cases').update({ sensitivity: 'normal', sensitivity_reason: 'Cliente autorizou por escrito' }).eq('id', casoSigiloso).select('sensitivity').single()
    expect(certo.error).toBeNull()
    expect(certo.data?.sensitivity).toBe('normal')
    // volta ao estado do cenário para os outros testes não dependerem da ordem
    await admin.from('legal_cases').update({ sensitivity: 'sigiloso' }).eq('id', casoSigiloso)
  })

  it('ninguém apaga caso pela API (sem política de DELETE)', async () => {
    const r = await P.dono.cliente.from('legal_cases').delete().eq('id', casoNormal).select('id')
    expect(r.data ?? []).toEqual([])
    const ainda = await admin.from('legal_cases').select('id').eq('id', casoNormal)
    expect((ainda.data ?? []).length).toBe(1)
  })
})

describe('participação societária só muda por ato', () => {
  it('UPDATE de percentual é recusado', async () => {
    const r = await P.dono.cliente.from('legal_ownerships').update({ percent: 50 }).eq('id', participacao).select('id')
    expect(r.error?.message ?? '').toMatch(/não muda/)
  })

  it('o ato fecha e abre na mesma transação; fechar participação inexistente é erro, não silêncio', async () => {
    const outra = exigir(await admin.from('legal_persons').insert({ tenant_id: tenantId, client_id: clientId, full_name: 'Herdeira Teste' }).select('id').single(), 'herdeira').id

    const erro = await P.dono.cliente.rpc('legal_apply_corporate_change', {
      p: { tenant_id: tenantId, entity_id: entidade, effective_on: '2026-06-01', kind: 'doacao_quotas', fechar: [randomUUID()], abrir: [] },
    })
    expect(erro.error?.message ?? '').toMatch(/não está aberta/)

    const ok = await P.dono.cliente.rpc('legal_apply_corporate_change', {
      p: {
        tenant_id: tenantId,
        entity_id: entidade,
        effective_on: '2026-06-01',
        kind: 'doacao_quotas',
        fechar: [participacao],
        abrir: [
          { owner_person_id: pessoaTitular, percent: 60 },
          { owner_person_id: outra, percent: 40, usufruct_person_id: pessoaTitular },
        ],
      },
    })
    expect(ok.error).toBeNull()
    const abertas = await admin.from('legal_ownerships').select('percent, owner_person_id').eq('owned_entity_id', entidade).is('valid_to', null)
    expect((abertas.data ?? []).map((x) => Number(x.percent)).sort((a, b) => a - b)).toEqual([40, 60])
    const fechada = await admin.from('legal_ownerships').select('valid_to').eq('id', participacao).single()
    expect(fechada.data?.valid_to).toBe('2026-06-01')
  })

  it('o financeiro não registra ato (a RLS vale dentro da função INVOKER)', async () => {
    const r = await P.financeiro.cliente.rpc('legal_apply_corporate_change', {
      p: { tenant_id: tenantId, entity_id: entidade, effective_on: '2026-07-01', kind: 'outro', fechar: [], abrir: [] },
    })
    expect(r.error).not.toBeNull()
  })
})
