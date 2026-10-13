import { createHash, randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarCliente } from '@/server/services/clientes'
import { abrirLote, gravarPedaco } from '@/server/services/lote-de-importacao'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste do lote de importação precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `lote-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  const { tenant } = await executarOnboarding(svc, { userId, businessName: 'Salão do Lote', vertical: 'nails', slug: `lote-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
}, 60_000)

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
    expect(segunda).toMatchObject({ gravadas: 0, jaGravadas: 3 })
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

  it('quem vem com a última visita ganha ciclo: o Motor já sabe quem está sumido', async () => {
    const { lote } = await abrir(1)
    const r = await gravarPedaco(svc, tenantId, lote.id, { linhas: [{ linha: 1, nome: 'Iara', ultimaVisita: '2026-06-01', etiquetas: [] }], ultimo: true })
    expect(r.previsao?.comDataInformada).toBe(1)
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
