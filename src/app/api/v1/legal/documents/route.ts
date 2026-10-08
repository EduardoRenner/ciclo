import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { enviarDocumento, EsquemaEnvio } from '@/server/advocacia/documentos'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerJson } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

/**
 * docs/101 T2.3: envia um documento (ou uma versão nova, com `documentId`). Multipart: `file` e os
 * campos do `EsquemaEnvio`. O tipo é conferido pelos bytes no serviço; o tamanho, aqui, antes de ler o
 * arquivo inteiro para a memória.
 */
const TAMANHO_MAXIMO = 50 * 1024 * 1024

export const POST = rota(async (req, _ctx, requestId) => {
  await exigirAal2()
  const ctx = await contextoAtual(req)
  if (ctx.tenant.pacote !== 'advocacia') throw new AppError('NOT_FOUND')
  exigirPermissao(ctx.papel, 'legal:create')

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('file')
  if (!(arquivo instanceof File)) throw AppError.validacao({ file: 'Escolha o arquivo.' })
  if (arquivo.size > TAMANHO_MAXIMO) throw AppError.validacao({ file: 'O arquivo passa de 50 MB.' })
  const campo = (k: string) => {
    const v = form?.get(k)
    return typeof v === 'string' && v !== '' ? v : undefined
  }
  const entrada = lerJson(EsquemaEnvio, {
    clientId: campo('clientId'),
    caseId: campo('caseId'),
    documentId: campo('documentId'),
    title: campo('title'),
    category: campo('category'),
    origin: campo('origin'),
    note: campo('note'),
  })
  const db = await criarClienteDoUsuario()
  await exigirModulo(db, ctx.tenantId, 'legal_documents')

  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/legal/documents' }, async () => {
    const r = await enviarDocumento(db, ctx.tenantId, ctx.sessao.userId, entrada, { bytes, mimeDeclarado: arquivo.type || null })
    await writeAudit(
      {
        tenantId: ctx.tenantId,
        actorId: ctx.sessao.userId,
        actorRole: ctx.papel,
        action: entrada.documentId ? 'legal_document.new_version' : 'legal_document.create',
        entity: 'legal_documents',
        entityId: r.documentId,
        // sem título nem nome de arquivo: só o que identifica o ato
        after: { versao: r.versao, categoria: entrada.category, origem: entrada.origin },
        requestId,
      },
      req,
    )
    return r
  })
})
