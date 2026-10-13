import { createHash, randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Temporal } from '@js-temporal/polyfill'

import { previaDoDinheiro } from '@/core/ingestao/previa-do-dinheiro'
import { criarCliente } from '@/server/services/clientes'
import { abrirLote, desfazerLote, gravarPedaco } from '@/server/services/lote-de-importacao'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  throw new Error('O teste do lote de importação precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string
let profissionalId: string
const senha = randomUUID()
const emails: Record<'dona' | 'profissional', string> = { dona: '', profissional: '' }

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  emails.dona = `lote-${marca}@ciclo.test`
  emails.profissional = `lote-prof-${marca}@ciclo.test`
  const { data, error } = await svc.auth.admin.createUser({ email: emails.dona, password: senha, email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  const { tenant } = await executarOnboarding(svc, { userId, businessName: 'Salão do Lote', vertical: 'nails', slug: `lote-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  const p = await svc.auth.admin.createUser({ email: emails.profissional, password: senha, email_confirm: true })
  if (p.error || !p.data.user) throw new Error(`seed profissional: ${p.error?.message}`)
  profissionalId = p.data.user.id
  const m = await svc.from('memberships').insert({ tenant_id: tenantId, user_id: profissionalId, role: 'professional' })
  if (m.error) throw new Error(`seed membership: ${m.error.message}`)
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
  await svc.auth.admin.deleteUser(profissionalId)
}, 60_000)

async function entrarComo(quem: 'dona' | 'profissional') {
  const c = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email: emails[quem], password: senha })
  if (error) throw new Error(`autenticar ${quem}: ${error.message}`)
  return c
}

const REGISTRO_VAZIO = { linhas: [1], nome: '', telefone: null, telefonesExtras: [], email: null, emailSugerido: null, nascimento: null, ultimaVisita: null as string | null, visitas: [], observacao: null, etiquetas: [], genero: null, origem: null, avisos: [] }
const contagens = { lidas: 3, ouro: 2, comAviso: 1, quarentena: 0, ignoradas: 0 }
const abrir = (rowsExpected = 3) =>
  abrirLote(svc, tenantId, userId, { fileSha256: createHash('sha256').update(randomUUID()).digest('hex'), formato: 'csv', origem: 'arquivo', nivel: 'N2', counts: contagens, rowsExpected })
const fichasDoLote = async (loteId: string) => (await svc.from('clients').select('id', { count: 'exact', head: true }).eq('import_batch_id', loteId)).count

describe('lote de importação (CNV-020) — contra o banco local', () => {
  it('o mesmo arquivo abre o mesmo lote, e diz que já existia', async () => {
    const hash = createHash('sha256').update(randomUUID()).digest('hex')
    const e = { fileSha256: hash, formato: 'csv', origem: 'arquivo' as const, nivel: 'N1' as const, counts: contagens, rowsExpected: 3 }
    const a = await abrirLote(svc, tenantId, userId, e)
    const b = await abrirLote(svc, tenantId, userId, e)
    expect(a.jaExistia).toBe(false)
    expect(b).toEqual({ lote: a.lote, jaExistia: true })
  })

  it('o mesmo pedaço duas vezes não duplica ninguém, nem quem não tem telefone (D5)', async () => {
    const { lote } = await abrir()
    const m = String(Date.now()).slice(-7)
    const linhas = [
      { linha: 1, nome: 'Ana Sem Telefone', etiquetas: [] },
      { linha: 2, nome: 'Bia Lima', telefone: `+551198${m}`, etiquetas: ['vip'] },
      { linha: 3, nome: 'Cris Souza', email: 'cris@exemplo.com.br', etiquetas: [] },
    ]
    const primeira = await gravarPedaco(svc, tenantId, lote.id, { linhas, ultimo: false })
    expect(primeira).toMatchObject({ gravadas: 3, jaGravadas: 0, puladas: [], erros: [] })
    const segunda = await gravarPedaco(svc, tenantId, lote.id, { linhas, ultimo: false })
    // Nenhum "já existe ficha com esse telefone" para a própria linha reenviada: ela é do lote, não de outra ficha.
    expect(segunda).toMatchObject({ gravadas: 0, jaGravadas: 3, puladas: [], erros: [] })
    expect(await fichasDoLote(lote.id)).toBe(3)
    expect(segunda.lote.rowsWritten).toBe(3)
    expect(segunda.lote.status).toBe('aberto')
  })

  it('telefone repetido no pedaço e telefone de ficha que já existe: pulados com o motivo, o resto entra', async () => {
    const m = String(Date.now()).slice(-7)
    await criarCliente(svc, tenantId, { name: 'Já Cliente', phone: `+551197${m}` } as never)
    const { lote } = await abrir()
    const r = await gravarPedaco(svc, tenantId, lote.id, {
      linhas: [
        { linha: 1, nome: 'Dani', telefone: `+551196${m}`, etiquetas: [] },
        { linha: 2, nome: 'Dani de Novo', telefone: `+551196${m}`, etiquetas: [] },
        { linha: 3, nome: 'Já Cliente', telefone: `+551197${m}`, etiquetas: [] },
      ],
      ultimo: false,
    })
    expect(r.gravadas).toBe(1)
    expect(r.puladas).toEqual([
      { linha: 2, motivo: 'Mesmo telefone da linha 1.' },
      { linha: 3, motivo: 'Já existe uma ficha com esse telefone.' },
    ])
  })

  it('o último pedaço conclui; depois disso nada mais entra, e a contagem é a do banco', async () => {
    const { lote } = await abrir(2)
    await gravarPedaco(svc, tenantId, lote.id, { linhas: [{ linha: 1, nome: 'Eva', etiquetas: [] }], ultimo: false })
    const fim = await gravarPedaco(svc, tenantId, lote.id, { linhas: [{ linha: 2, nome: 'Fabi', etiquetas: [] }], ultimo: true })
    expect(fim.lote).toMatchObject({ status: 'concluido', rowsWritten: 2 })
    await expect(gravarPedaco(svc, tenantId, lote.id, { linhas: [{ linha: 2, nome: 'Fabi', etiquetas: [] }], ultimo: true })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('linha além do total combinado é recusada antes de gravar qualquer coisa', async () => {
    const { lote } = await abrir(1)
    await expect(gravarPedaco(svc, tenantId, lote.id, { linhas: [{ linha: 1, nome: 'Gabi', etiquetas: [] }, { linha: 2, nome: 'Helô', etiquetas: [] }], ultimo: false })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect(await fichasDoLote(lote.id)).toBe(0)
  })

  it('quem vem com a última visita ganha ciclo GRAVADO no serviço escolhido: o Motor passa a acompanhar', async () => {
    const { data: servico } = await svc.from('services').select('id').eq('tenant_id', tenantId).gt('cycle_days', 0).limit(1).single()
    const { lote } = await abrir(1)
    const r = await gravarPedaco(svc, tenantId, lote.id, { linhas: [{ linha: 1, nome: 'Iara', ultimaVisita: '2026-06-01', etiquetas: [] }], ultimo: true, servicoId: servico!.id })
    expect(r.previsao).toMatchObject({ comDataInformada: 1, cyclesGravados: 1 })
    const { data: ficha } = await svc.from('clients').select('id').eq('import_batch_id', lote.id).single()
    const { count } = await svc.from('client_cycles').select('client_id', { count: 'exact', head: true }).eq('client_id', ficha!.id)
    expect(count).toBe(1)
    const { data } = await svc.from('clients').select('last_visit_at, source').eq('import_batch_id', lote.id).single()
    expect(data?.last_visit_at?.slice(0, 10)).toBe('2026-06-01')
    expect(data?.source).toBe('csv_import')
  })

  it('500 fichas num pedaço em menos de 10 segundos', async () => {
    const { lote } = await abrir(500)
    const base = 10_000_000 + Math.floor(Math.random() * 80_000_000)
    const linhas = Array.from({ length: 500 }, (_, i) => ({ linha: i + 1, nome: `Pessoa ${i}`, telefone: `+55119${base + i}`, etiquetas: [] }))
    const inicio = Date.now()
    const r = await gravarPedaco(svc, tenantId, lote.id, { linhas, ultimo: true })
    expect(Date.now() - inicio).toBeLessThan(10_000)
    expect(r.gravadas).toBe(500)
    expect(r.lote.rowsWritten).toBe(500)
  }, 30_000)
})

describe('desfazer a importação (CNV-022) — como a dona, contra o banco local', () => {
  it('tira as fichas que ninguém usou, mantém a que já tem nota, e o telefone pode entrar de novo', async () => {
    const dona = await entrarComo('dona')
    const { lote } = await abrirLote(dona, tenantId, userId, { fileSha256: createHash('sha256').update(randomUUID()).digest('hex'), formato: 'csv', origem: 'arquivo', nivel: 'N1', counts: contagens, rowsExpected: 3 })
    const m = String(Date.now()).slice(-7)
    await gravarPedaco(dona, tenantId, lote.id, {
      linhas: [
        { linha: 1, nome: 'Jade', telefone: `+551195${m}`, etiquetas: [] },
        { linha: 2, nome: 'Kika', etiquetas: [] },
        { linha: 3, nome: 'Lia Usada', etiquetas: [] },
      ],
      ultimo: true,
    })
    const { data: usada } = await svc.from('clients').select('id').eq('import_batch_id', lote.id).eq('import_row', 3).single()
    await svc.from('client_notes').insert({ tenant_id: tenantId, client_id: usada!.id, body: 'Prefere o fim da tarde.' })

    expect(await desfazerLote(dona, lote.id)).toEqual({ removidas: 2, mantidas: 1 })

    const { data: fichas } = await svc.from('clients').select('import_row, deleted_at').eq('import_batch_id', lote.id).order('import_row')
    expect(fichas?.map((f) => [f.import_row, f.deleted_at === null])).toEqual([[1, false], [2, false], [3, true]])
    const { data: estado } = await svc.from('import_batches').select('status, undone_at, undone_by').eq('id', lote.id).single()
    expect(estado).toMatchObject({ status: 'desfeito', undone_by: userId })

    // O telefone da ficha tirada pode entrar de novo, por outro lote do mesmo arquivo inclusive.
    const outro = await abrirLote(dona, tenantId, userId, { fileSha256: createHash('sha256').update(randomUUID()).digest('hex'), formato: 'csv', origem: 'arquivo', nivel: 'N1', counts: contagens, rowsExpected: 1 })
    const deNovo = await gravarPedaco(dona, tenantId, outro.lote.id, { linhas: [{ linha: 1, nome: 'Jade', telefone: `+551195${m}`, etiquetas: [] }], ultimo: true })
    expect(deNovo.gravadas).toBe(1)
  })

  it('não desfaz duas vezes, nem depois de 7 dias, nem pelo profissional', async () => {
    const dona = await entrarComo('dona')
    const abrirComo = (db: typeof dona) => abrirLote(db, tenantId, userId, { fileSha256: createHash('sha256').update(randomUUID()).digest('hex'), formato: 'csv', origem: 'arquivo', nivel: 'N1', counts: contagens, rowsExpected: 1 })

    const a = await abrirComo(dona)
    await desfazerLote(dona, a.lote.id)
    await expect(desfazerLote(dona, a.lote.id)).rejects.toMatchObject({ code: 'CONFLICT' })

    const velho = await abrirComo(dona)
    await svc.from('import_batches').update({ created_at: new Date(Date.now() - 8 * 86_400_000).toISOString() }).eq('id', velho.lote.id)
    await expect(desfazerLote(dona, velho.lote.id)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringMatching(/7 dias/) })

    const doProfissional = await abrirComo(dona)
    await expect(desfazerLote(await entrarComo('profissional'), doProfissional.lote.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const { data } = await svc.from('import_batches').select('status').eq('id', doProfissional.lote.id).single()
    expect(data?.status).toBe('aberto')
  })
})

describe('o R$ da prévia é o que a Hoje soma depois de gravar (CNV-021)', () => {
  it('soma de value_at_risk_cents das fichas do lote = previaDoDinheiro, pessoa a pessoa', async () => {
    const { data: servico } = await svc.from('services').select('id, price_cents, cycle_days').eq('tenant_id', tenantId).gt('cycle_days', 0).gt('price_cents', 0).limit(1).single()
    const hoje = Temporal.Now.plainDateISO()
    const dias = [2, 15, 25, 40, 80, 200]
    const registros = dias.map((d, i) => ({ ...REGISTRO_VAZIO, linhas: [i + 1], nome: `Volta ${i}`, ultimaVisita: hoje.subtract({ days: servico!.cycle_days! + d - 5 }).toString() }))
    const previa = previaDoDinheiro(registros, { priceCents: servico!.price_cents, cycleDays: servico!.cycle_days! }, hoje.toString())
    expect(previa.sumidos, 'o cenário precisa ter gente sumida, senão a igualdade passa no zero').toBeGreaterThan(3)

    const { lote } = await abrir(registros.length)
    await gravarPedaco(svc, tenantId, lote.id, {
      linhas: registros.map((r, i) => ({ linha: i + 1, nome: r.nome, ultimaVisita: r.ultimaVisita, etiquetas: [] })),
      ultimo: true,
      servicoId: servico!.id,
    })
    const { data: fichas } = await svc.from('clients').select('id').eq('import_batch_id', lote.id)
    const { data: ciclos } = await svc.from('client_cycles').select('value_at_risk_cents').in('client_id', fichas!.map((f) => f.id))
    expect(ciclos!.reduce((s, c) => s + c.value_at_risk_cents, 0)).toBe(previa.valorCents)
  })
})
