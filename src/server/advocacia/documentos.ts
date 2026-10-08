import { createHash, randomUUID } from 'node:crypto'

import { z } from 'zod'

import { CATEGORIAS, conferirArquivo, type CategoriaDoDocumento, type DocumentoNaLista } from '@/core/advocacia/documentos'
import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * Documentos do pacote Advocacia (docs/101 T2.3). Duas chaves, cada uma no seu papel:
 *  - o cliente do USUÁRIO decide QUEM alcança o documento (RLS de `legal_documents`, que segue o caso);
 *  - a chave de serviço, só dentro de `withTenant`, toca o bucket `legal-docs` (privado e sem política
 *    de storage: ninguém lê nem grava objeto pelo navegador) e a trilha `legal_access_log`.
 * Toda consulta com a chave de serviço filtra `tenant_id`, e o id do documento só chega até ela depois de
 * a leitura pelo cliente do usuário ter achado a linha.
 */

const BUCKET = 'legal-docs'
const URL_ASSINADA_SEGUNDOS = 60

export const EsquemaEnvio = z
  .object({
    clientId: z.uuid(),
    caseId: z.uuid().optional(),
    // presente: nova VERSÃO de um documento que já existe
    documentId: z.uuid().optional(),
    title: z.string().trim().min(2).max(200),
    category: z.enum(Object.keys(CATEGORIAS) as [CategoriaDoDocumento, ...CategoriaDoDocumento[]]).default('outro'),
    // `cliente`: recebido do cliente e lançado pela equipe; entra em quarentena até alguém conferir
    origin: z.enum(['equipe', 'cliente']).default('equipe'),
    note: z.string().trim().max(300).optional(),
  })
  .strict()

export type EntradaEnvio = z.infer<typeof EsquemaEnvio>

export async function enviarDocumento(
  db: Cliente,
  tenantId: string,
  userId: string,
  e: EntradaEnvio,
  arquivo: { bytes: Uint8Array; mimeDeclarado: string | null },
): Promise<{ documentId: string; versao: number }> {
  const conf = conferirArquivo(arquivo.bytes, arquivo.mimeDeclarado)
  if (!conf.ok) throw AppError.validacao({ file: conf.motivo })

  // 1) o alcance, ANTES de qualquer byte ir para o bucket
  let documentId = e.documentId
  let clienteId = e.clientId
  let novo = false
  let sigiloso = false
  if (documentId) {
    const atual = await db.from('legal_documents').select('client_id').eq('tenant_id', tenantId).eq('id', documentId).maybeSingle()
    if (atual.error) throw new AppError('INTERNAL', { cause: atual.error })
    if (!atual.data) throw new AppError('NOT_FOUND', { message: 'Esse documento não está mais disponível.' })
    clienteId = atual.data.client_id
  } else {
    novo = true
    documentId = randomUUID()
    if (e.caseId) {
      const caso = await db.from('legal_cases').select('client_id, sensitivity').eq('tenant_id', tenantId).eq('id', e.caseId).maybeSingle()
      if (caso.error) throw new AppError('INTERNAL', { cause: caso.error })
      if (!caso.data) throw new AppError('NOT_FOUND', { message: 'Esse caso não está mais disponível.' })
      if (caso.data.client_id !== e.clientId) throw AppError.validacao({ caseId: 'O caso é de outro cliente.' })
      sigiloso = caso.data.sensitivity === 'sigiloso'
    }
  }
  const versoes = await db.from('legal_document_versions').select('version_no').eq('tenant_id', tenantId).eq('document_id', documentId)
  if (versoes.error) throw new AppError('INTERNAL', { cause: versoes.error })
  const versao = Math.max(0, ...(versoes.data ?? []).map((v) => v.version_no)) + 1

  // 2) o arquivo: caminho só de uuids (o nome original pode ter dado pessoal), nunca sobrescreve
  const caminho = `${tenantId}/${clienteId}/${documentId}/${versao}`
  await withTenant(tenantId, async (svc) => {
    const r = await svc.storage.from(BUCKET).upload(caminho, arquivo.bytes, { contentType: conf.mime, upsert: false, cacheControl: '0' })
    if (r.error) throw new AppError('INTERNAL', { cause: r.error })
  })

  // 3) as linhas; se falhar, o objeto sai do bucket (compensação) para não ficar arquivo sem dono
  try {
    if (novo) {
      const r = await db.from('legal_documents').insert({
        id: documentId,
        tenant_id: tenantId,
        client_id: clienteId,
        case_id: e.caseId ?? null,
        title: e.title,
        category: e.category,
        origin: e.origin,
        status: e.origin === 'cliente' ? 'recebido' : 'aceito',
        sensitivity: sigiloso ? 'sigiloso' : 'normal',
        created_by: userId,
      })
      if (r.error) throw new AppError('INTERNAL', { cause: r.error })
    }
    const versaoId = randomUUID()
    const v = await db.from('legal_document_versions').insert({
      id: versaoId,
      tenant_id: tenantId,
      document_id: documentId,
      version_no: versao,
      storage_path: caminho,
      mime: conf.mime,
      size_bytes: arquivo.bytes.length,
      sha256: createHash('sha256').update(arquivo.bytes).digest('hex'),
      note: e.note ?? null,
      uploaded_by: userId,
    })
    if (v.error) throw new AppError('INTERNAL', { cause: v.error })
    const u = await db
      .from('legal_documents')
      .update({ current_version_id: versaoId, ...(e.origin === 'cliente' ? { status: 'recebido' as const, reviewed_by: null, reviewed_at: null } : {}) })
      .eq('tenant_id', tenantId)
      .eq('id', documentId)
      .select('id')
    if (u.error) throw new AppError('INTERNAL', { cause: u.error })
    if (!u.data || u.data.length === 0) throw new AppError('NOT_FOUND', { message: 'Esse documento não está mais disponível.' })
  } catch (erro) {
    await withTenant(tenantId, async (svc) => {
      await svc.storage.from(BUCKET).remove([caminho])
    })
    throw erro
  }
  return { documentId, versao }
}

/**
 * Abre a versão atual: a leitura pelo cliente do USUÁRIO decide se alcança; só então a trilha é gravada
 * e a URL de 60 s é assinada. Documento inexistente e documento de caso sigiloso fora do alcance dão o
 * mesmo 404.
 */
export async function abrirDocumento(
  db: Cliente,
  tenantId: string,
  documentId: string,
  quem: { userId: string; ip: string | null },
): Promise<{ url: string; expiresInSeconds: number }> {
  const doc = await db
    .from('legal_documents')
    .select('id, client_id, case_id, current_version_id')
    .eq('tenant_id', tenantId)
    .eq('id', documentId)
    .maybeSingle()
  if (doc.error) throw new AppError('INTERNAL', { cause: doc.error })
  if (!doc.data?.current_version_id) throw new AppError('NOT_FOUND', { message: 'Esse documento não está mais disponível.' })
  const versaoId = doc.data.current_version_id
  const versao = await db.from('legal_document_versions').select('storage_path, removed_at').eq('tenant_id', tenantId).eq('id', versaoId).maybeSingle()
  if (versao.error) throw new AppError('INTERNAL', { cause: versao.error })
  if (!versao.data || versao.data.removed_at) throw new AppError('NOT_FOUND', { message: 'Esse arquivo foi removido.' })

  return withTenant(tenantId, async (svc) => {
    const trilha = await svc.from('legal_access_log').insert({
      tenant_id: tenantId,
      user_id: quem.userId,
      client_id: doc.data!.client_id,
      document_id: documentId,
      version_id: versaoId,
      case_id: doc.data!.case_id,
      kind: 'view',
      ip_hash: quem.ip ? createHash('sha256').update(quem.ip).digest('hex').slice(0, 32) : null,
    })
    // sem trilha, sem arquivo: abrir sem registrar seria a única leitura sensível que não deixa rastro
    if (trilha.error) throw new AppError('INTERNAL', { cause: trilha.error })
    const r = await svc.storage.from(BUCKET).createSignedUrl(versao.data!.storage_path, URL_ASSINADA_SEGUNDOS)
    if (r.error || !r.data) throw new AppError('INTERNAL', { cause: r.error })
    return { url: r.data.signedUrl, expiresInSeconds: URL_ASSINADA_SEGUNDOS }
  })
}

export const EsquemaConferencia = z
  .object({
    acao: z.enum(['aceitar', 'recusar']),
    motivo: z.string().trim().max(300).optional(),
    rowVersion: z.number().int().min(1),
  })
  .strict()
  .refine((e) => e.acao !== 'recusar' || (e.motivo ?? '').length >= 5, { message: 'Escreva o motivo da recusa (pelo menos 5 letras).', path: ['motivo'] })

/** A conferência do documento recebido do cliente: aceitar ou recusar com motivo, com concorrência por versão. */
export async function conferirDocumento(
  db: Cliente,
  tenantId: string,
  documentId: string,
  userId: string,
  e: z.infer<typeof EsquemaConferencia>,
): Promise<{ status: string }> {
  const { data, error } = await db
    .from('legal_documents')
    .update({
      status: e.acao === 'aceitar' ? 'aceito' : 'recusado',
      refused_reason: e.acao === 'recusar' ? e.motivo! : null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      row_version: e.rowVersion + 1,
    })
    .eq('tenant_id', tenantId)
    .eq('id', documentId)
    .eq('row_version', e.rowVersion)
    .select('status')
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data || data.length === 0) {
    throw new AppError('CONFLICT', { message: 'Este documento mudou ou não está mais disponível. Recarregue para ver a versão atual.' })
  }
  return { status: data[0]!.status }
}

export async function listarDocumentos(db: Cliente, tenantId: string, filtro: { clienteId?: string; casoId?: string }): Promise<DocumentoNaLista[]> {
  let q = db
    .from('legal_documents')
    .select('id, title, category, status, origin, valid_until, case_id, row_version, legal_document_versions!legal_document_versions_document_id_tenant_id_fkey(version_no)')
    .eq('tenant_id', tenantId)
    .is('archived_at', null)
  if (filtro.clienteId) q = q.eq('client_id', filtro.clienteId)
  if (filtro.casoId) q = q.eq('case_id', filtro.casoId)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  if (error) throw new AppError('INTERNAL', { cause: error })
  type Linha = {
    id: string
    title: string
    category: string
    status: string
    origin: string
    valid_until: string | null
    case_id: string | null
    row_version: number
    legal_document_versions: { version_no: number }[]
  }
  return ((data ?? []) as unknown as Linha[]).map((d) => ({
    id: d.id,
    titulo: d.title,
    categoria: d.category,
    status: d.status,
    origem: d.origin,
    versao: Math.max(0, ...d.legal_document_versions.map((v) => v.version_no)),
    rowVersion: d.row_version,
    validade: d.valid_until,
    casoId: d.case_id,
  }))
}
