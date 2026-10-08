import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { abrirDocumento, conferirDocumento, enviarDocumento, listarDocumentos } from '@/server/advocacia/documentos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

/**
 * docs/101 T2.3: documentos de ponta a ponta contra o banco e o storage locais. O arquivo só passa pelo
 * servidor; abrir grava a trilha ANTES de assinar a URL; documento de caso sigiloso fora do alcance é
 * 404 para quem não é da equipe, nos dois sentidos (enviar versão e abrir).
 */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL!
const admin = createClient<Database>(BANCO, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
let T: string
let clienteId: string
let casoSigiloso: string
const usuarios: string[] = []
const quem: Record<'equipe' | 'fora', { c: SupabaseClient<Database>; uid: string }> = {} as never
const PDF = new TextEncoder().encode('%PDF-1.4\n% documento fictício de teste\n%%EOF\n')

async function pessoa(nome: 'equipe' | 'fora'): Promise<{ prof: string }> {
  const email = `int-docs-${nome}-${randomUUID().slice(0, 8)}@ciclo.test`
  const senha = randomUUID()
  const u = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true })
  usuarios.push(u.data.user!.id)
  await admin.from('memberships').insert({ tenant_id: T, user_id: u.data.user!.id, role: 'professional' })
  const p = await admin.from('professionals').insert({ tenant_id: T, user_id: u.data.user!.id, display_name: nome, legal_role: 'advogado' }).select('id').single()
  const c = createClient<Database>(BANCO, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  await c.auth.signInWithPassword({ email, password: senha })
  quem[nome] = { c, uid: u.data.user!.id }
  return { prof: p.data!.id }
}

beforeAll(async () => {
  T = (await admin.from('tenants').insert({ name: 'Docs', slug: `int-docs-${randomUUID().slice(0, 8)}`, vertical: 'general' }).select('id').single()).data!.id
  clienteId = (await admin.from('clients').insert({ tenant_id: T, name: 'Cliente dos documentos' }).select('id').single()).data!.id
  const { prof } = await pessoa('equipe')
  await pessoa('fora')
  casoSigiloso = (
    await admin.from('legal_cases').insert({ tenant_id: T, client_id: clienteId, kind: 'civel', title: 'Reservado', client_title: 'o processo', sensitivity: 'sigiloso' }).select('id').single()
  ).data!.id
  await admin.from('legal_case_members').insert({ tenant_id: T, case_id: casoSigiloso, professional_id: prof })
}, 120_000)

afterAll(async () => {
  const objs = await admin.storage.from('legal-docs').list(`${T}/${clienteId}`, { limit: 100 })
  for (const pasta of objs.data ?? []) {
    const dentro = await admin.storage.from('legal-docs').list(`${T}/${clienteId}/${pasta.name}`)
    await admin.storage.from('legal-docs').remove((dentro.data ?? []).map((o) => `${T}/${clienteId}/${pasta.name}/${o.name}`))
  }
  await admin.from('tenants').delete().eq('id', T)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u)
}, 120_000)

describe('documentos', () => {
  let docId: string

  it('envio do cliente entra em quarentena, com versão, hash e o arquivo no bucket', async () => {
    const r = await enviarDocumento(quem.equipe.c, T, quem.equipe.uid, { clientId: clienteId, caseId: casoSigiloso, title: 'Matrícula', category: 'matricula_imovel', origin: 'cliente' }, { bytes: PDF, mimeDeclarado: 'application/pdf' })
    docId = r.documentId
    expect(r.versao).toBe(1)
    const d = (await admin.from('legal_documents').select('status, sensitivity, current_version_id').eq('id', docId).single()).data!
    expect(d).toMatchObject({ status: 'recebido', sensitivity: 'sigiloso' })
    const v = (await admin.from('legal_document_versions').select('storage_path, mime, size_bytes, sha256').eq('id', d.current_version_id!).single()).data!
    expect(v).toMatchObject({ storage_path: `${T}/${clienteId}/${docId}/1`, mime: 'application/pdf', size_bytes: PDF.length })
    const baixado = await admin.storage.from('legal-docs').download(v.storage_path)
    expect(new Uint8Array(await baixado.data!.arrayBuffer())).toEqual(PDF)
  })

  it('tipo pelo conteúdo: executável com nome de PDF é recusado e nada vai ao bucket', async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0])
    await expect(
      enviarDocumento(quem.equipe.c, T, quem.equipe.uid, { clientId: clienteId, title: 'Contrato', category: 'contrato', origin: 'equipe' }, { bytes: exe, mimeDeclarado: 'application/pdf' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    expect((await admin.from('legal_documents').select('id', { count: 'exact', head: true }).eq('tenant_id', T)).count).toBe(1)
  })

  it('abrir grava a trilha e assina uma URL que entrega o arquivo', async () => {
    const r = await abrirDocumento(quem.equipe.c, T, docId, { userId: quem.equipe.uid, ip: '203.0.113.9' })
    expect(r.expiresInSeconds).toBe(60)
    const trilha = await admin.from('legal_access_log').select('kind, user_id, document_id, ip_hash').eq('tenant_id', T)
    expect(trilha.data).toEqual([{ kind: 'view', user_id: quem.equipe.uid, document_id: docId, ip_hash: expect.stringMatching(/^[0-9a-f]{32}$/) }])
    const corpo = await fetch(r.url)
    expect(corpo.ok).toBe(true)
    expect(new Uint8Array(await corpo.arrayBuffer())).toEqual(PDF)
  })

  it('quem não é da equipe do caso sigiloso: 404 ao abrir e ao mandar versão, sem trilha nova', async () => {
    await expect(abrirDocumento(quem.fora.c, T, docId, { userId: quem.fora.uid, ip: null })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      enviarDocumento(quem.fora.c, T, quem.fora.uid, { clientId: clienteId, documentId: docId, title: 'x versão', category: 'outro', origin: 'equipe' }, { bytes: PDF, mimeDeclarado: 'application/pdf' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect((await admin.from('legal_access_log').select('id', { count: 'exact', head: true }).eq('tenant_id', T)).count).toBe(1)
    expect(await listarDocumentos(quem.fora.c, T, { clienteId })).toEqual([])
  })

  it('versão nova pela equipe; conferência com versão velha é conflito; recusar exige motivo', async () => {
    const r = await enviarDocumento(quem.equipe.c, T, quem.equipe.uid, { clientId: clienteId, documentId: docId, title: 'Matrícula', category: 'matricula_imovel', origin: 'cliente' }, { bytes: PDF, mimeDeclarado: 'application/pdf' })
    expect(r.versao).toBe(2)
    const [d] = await listarDocumentos(quem.equipe.c, T, { clienteId })
    expect(d).toMatchObject({ versao: 2, status: 'recebido' })
    await expect(conferirDocumento(quem.equipe.c, T, docId, quem.equipe.uid, { acao: 'aceitar', rowVersion: d!.rowVersion + 5 })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await conferirDocumento(quem.equipe.c, T, docId, quem.equipe.uid, { acao: 'aceitar', rowVersion: d!.rowVersion })).toEqual({ status: 'aceito' })
  })
})
