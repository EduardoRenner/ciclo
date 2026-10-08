import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste de prazos do pacote Advocacia precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

/**
 * docs/101 anexo 02 A5/A22 e anexo 05 §6 (Fase 1/4): a blindagem do prazo fatal no BANCO e a porta
 * de gravação das intimações. A regra mais cara do produto: prazo fatal não se adia, não muda sem
 * motivo, não se cumpre sem prova, e quem é de estágio cria fatal "a confirmar".
 */
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

type Pessoa = { userId: string; cliente: SupabaseClient }
let tenantId: string
let clientId: string
let casoId: string
const usuarios: string[] = []
const P = {} as Record<'advocacia' | 'estagio' | 'secretaria', Pessoa>

function exigir<T extends { id?: string }>(r: { data: T | null; error: { message: string } | null }, onde: string): { id: string } {
  if (r.error) throw new Error(`seed falhou em ${onde}: ${r.error.message}`)
  if (!r.data?.id) throw new Error(`seed em ${onde} não devolveu id`)
  return { id: r.data.id }
}

async function pessoa(nome: string, papel: 'professional' | 'reception', legalRole: 'advogado' | 'estagio' | null): Promise<Pessoa> {
  const email = `rls-prazo-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed ${nome}: ${error?.message}`)
  usuarios.push(data.user.id)
  exigir(await admin.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: papel }).select('id').single(), `membership ${nome}`)
  exigir(
    await admin.from('professionals').insert({ tenant_id: tenantId, user_id: data.user.id, display_name: nome, legal_role: legalRole }).select('id').single(),
    `professional ${nome}`,
  )
  const cliente = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: e } = await cliente.auth.signInWithPassword({ email, password: senha })
  if (e) throw new Error(`login ${nome}: ${e.message}`)
  return { userId: data.user.id, cliente }
}

beforeAll(async () => {
  tenantId = exigir(await admin.from('tenants').insert({ name: 'Escritório prazos', slug: `rls-prazos-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single(), 'tenant').id
  clientId = exigir(await admin.from('clients').insert({ tenant_id: tenantId, name: 'Cliente prazos' }).select('id').single(), 'client').id
  casoId = exigir(
    await admin
      .from('legal_cases')
      .insert({ tenant_id: tenantId, client_id: clientId, kind: 'civel', title: 'Ação de teste', client_title: 'Seu processo', cnj_number: '00012345620268240001' })
      .select('id')
      .single(),
    'caso',
  ).id
  P.advocacia = await pessoa('advocacia', 'professional', 'advogado')
  P.estagio = await pessoa('estagio', 'professional', 'estagio')
  P.secretaria = await pessoa('secretaria', 'reception', null)
}, 180_000)

afterAll(async () => {
  await admin.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 120_000)

async function novoFatal(quem: Pessoa, extra: Record<string, unknown> = {}) {
  return quem.cliente
    .from('legal_deadlines')
    .insert({ tenant_id: tenantId, client_id: clientId, case_id: casoId, kind: 'fatal', title: 'Contestação', due_on: '2026-11-20', ...extra })
    .select('id, confirmed_at')
    .single()
}

describe('quem cria prazo fatal', () => {
  it('advocacia cria (controle positivo)', async () => {
    const r = await novoFatal(P.advocacia, { confirmed_by: P.advocacia.userId, confirmed_at: new Date().toISOString() })
    expect(r.error).toBeNull()
    expect(r.data?.confirmed_at).not.toBeNull()
  })

  it('estágio cria, mas nasce sem confirmação mesmo que tente se confirmar', async () => {
    const r = await novoFatal(P.estagio, { confirmed_by: P.estagio.userId, confirmed_at: new Date().toISOString() })
    expect(r.error).toBeNull()
    expect(r.data?.confirmed_at).toBeNull()
  })

  it('secretaria não cria prazo fatal', async () => {
    const r = await novoFatal(P.secretaria)
    expect(r.error).not.toBeNull()
  })
})

describe('a blindagem do prazo fatal', () => {
  let prazo: string
  beforeAll(async () => {
    prazo = exigir(await novoFatal(P.advocacia), 'prazo fatal').id
  })

  it('não se adia', async () => {
    const r = await P.advocacia.cliente.from('legal_deadlines').update({ due_on: '2026-11-27', change_reason: 'cliente pediu mais tempo' }).eq('id', prazo).select('id')
    expect(r.error?.message ?? '').toMatch(/não pode ser adiado/)
  })

  it('antecipar exige motivo; com motivo, grava o antes e o depois no histórico', async () => {
    const sem = await P.advocacia.cliente.from('legal_deadlines').update({ due_on: '2026-11-18' }).eq('id', prazo).select('id')
    expect(sem.error?.message ?? '').toMatch(/exige motivo/)
    const com = await P.advocacia.cliente.from('legal_deadlines').update({ due_on: '2026-11-18', change_reason: 'Contagem corrigida: feriado municipal' }).eq('id', prazo).select('due_on').single()
    expect(com.error).toBeNull()
    expect(com.data?.due_on).toBe('2026-11-18')
    const hist = await admin.from('legal_deadline_changes').select('field, old_value, new_value, reason').eq('deadline_id', prazo)
    expect(hist.data).toEqual([{ field: 'due_on', old_value: '2026-11-20', new_value: '2026-11-18', reason: 'Contagem corrigida: feriado municipal' }])
  })

  it('cumprir sem prova é recusado; com a nota de protocolo, passa', async () => {
    const agora = new Date().toISOString()
    const sem = await P.advocacia.cliente.from('legal_deadlines').update({ status: 'cumprido', closed_at: agora }).eq('id', prazo).select('id')
    expect(sem.error).not.toBeNull()
    const com = await P.advocacia.cliente
      .from('legal_deadlines')
      .update({ status: 'cumprido', closed_at: agora, close_note: 'Protocolo 2026/12345 enviado' })
      .eq('id', prazo)
      .select('status')
      .single()
    expect(com.error).toBeNull()
    expect(com.data?.status).toBe('cumprido')
  })

  it('ninguém forja histórico: nem insert direto, nem a função chamada fora do gatilho', async () => {
    const direto = await P.advocacia.cliente
      .from('legal_deadline_changes')
      .insert({ tenant_id: tenantId, deadline_id: prazo, field: 'due_on', old_value: 'x', new_value: 'y' })
    expect(direto.error).not.toBeNull()
    const rpc = await P.advocacia.cliente.rpc('legal_registrar_mudanca_de_prazo', {
      p_tenant: tenantId, p_deadline: prazo, p_campo: 'due_on', p_antes: 'x', p_depois: 'y', p_motivo: 'forjado',
    })
    expect(rpc.error?.message ?? '').toMatch(/só é gravado pelo próprio prazo/)
  })

  it('ninguém apaga prazo pela API', async () => {
    const r = await P.advocacia.cliente.from('legal_deadlines').delete().eq('id', prazo).select('id')
    expect(r.data ?? []).toEqual([])
    expect(((await admin.from('legal_deadlines').select('id').eq('id', prazo)).data ?? []).length).toBe(1)
  })
})

describe('a captura de intimações', () => {
  const lote = (itens: Record<string, unknown>[], countFonte: number) => ({
    tenant_id: tenantId,
    alvo: 'oab:12345/SC',
    dia: '2026-10-05',
    count_fonte: countFonte,
    itens,
  })
  // o formato de `corpoDaRpc` (core/advocacia/intimacoes.ts), que a 0113 passou a ler: `texto_sanitizado`
  const item = (djenId: number, processo: string) => ({
    djen_id: djenId,
    numero_processo: processo,
    data_disponibilizacao: '2026-10-05',
    tribunal: 'TJSC',
    texto_sanitizado: 'Fica a parte intimada para se manifestar no prazo de 15 (quinze) dias. Exemplo fictício.',
    destinatarios: [{ nome: 'Parte de exemplo', polo: 'A' }],
  })

  it('só o servidor grava; vincula pelo número do processo; segunda gravação não duplica', async () => {
    const pelaApi = await P.advocacia.cliente.rpc('legal_intimacoes_gravar', { p: lote([item(1, '00012345620268240001')], 1) })
    expect(pelaApi.error).not.toBeNull()

    const r1 = await admin.rpc('legal_intimacoes_gravar', { p: lote([item(1, '00012345620268240001'), item(2, '99999999920268240001')], 2) })
    expect(r1.error).toBeNull()
    await admin.rpc('legal_intimacoes_gravar', { p: lote([item(1, '00012345620268240001'), item(2, '99999999920268240001')], 2) })
    const gravadas = await admin.from('legal_intimations').select('djen_id, status, case_id').eq('tenant_id', tenantId).order('djen_id')
    expect(gravadas.data).toEqual([
      { djen_id: 1, status: 'vinculada', case_id: casoId },
      { djen_id: 2, status: 'nova', case_id: null },
    ])
    const sync = await admin.from('legal_intimation_sync').select('ok, count_fonte, count_gravado').eq('tenant_id', tenantId).single()
    expect(sync.data).toEqual({ ok: true, count_fonte: 2, count_gravado: 2 })
  })

  it('a fonte diz que havia mais do que chegou: o dia fica marcado como NÃO conferido', async () => {
    await admin.rpc('legal_intimacoes_gravar', { p: { ...lote([], 5), dia: '2026-10-06' } })
    const sync = await admin.from('legal_intimation_sync').select('ok, detalhe').eq('tenant_id', tenantId).eq('dia', '2026-10-06').single()
    expect(sync.data?.ok).toBe(false)
  })

  it('o texto do tribunal não sai no SELECT direto; sai pela porta que registra quem abriu', async () => {
    const direto = await P.advocacia.cliente.from('legal_intimations').select('texto_sanitizado').eq('tenant_id', tenantId)
    expect(direto.error?.message ?? '').toMatch(/permission denied/)
    const id = (await admin.from('legal_intimations').select('id').eq('tenant_id', tenantId).eq('djen_id', 2).single()).data!.id
    const antes = (await admin.from('legal_access_log').select('id').eq('tenant_id', tenantId).eq('kind', 'open_intimation')).data?.length ?? 0
    const porta = await P.advocacia.cliente.rpc('legal_abrir_intimacao', { p_id: id })
    expect(porta.error).toBeNull()
    expect((porta.data as { texto: string }[])[0]?.texto).toMatch(/prazo de 15/)
    const depois = (await admin.from('legal_access_log').select('id').eq('tenant_id', tenantId).eq('kind', 'open_intimation')).data?.length ?? 0
    expect(depois).toBe(antes + 1)
  })

  it('a secretaria não lê intimação sem caso (nem as colunas liberadas)', async () => {
    const r = await P.secretaria.cliente.from('legal_intimations').select('id').eq('tenant_id', tenantId).eq('djen_id', 2)
    expect(r.data ?? []).toEqual([])
    // controle: a advocacia lê a mesma linha
    const a = await P.advocacia.cliente.from('legal_intimations').select('id').eq('tenant_id', tenantId).eq('djen_id', 2)
    expect((a.data ?? []).length).toBe(1)
  })

  it('o conteúdo do tribunal não muda depois de gravado', async () => {
    const r = await admin.from('legal_intimations').update({ texto_sanitizado: 'outro texto' }).eq('tenant_id', tenantId).eq('djen_id', 1).select('id')
    expect(r.error?.message ?? '').toMatch(/não se altera/)
  })
})
