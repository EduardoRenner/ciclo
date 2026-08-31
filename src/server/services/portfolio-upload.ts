import { randomUUID } from 'node:crypto'

import sharp from 'sharp'

import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'

/**
 * `docs/35-FOTOS-CONSENTIMENTO-PLANO.md`, TICKET-115 — o lado com `sharp`, separado de
 * `portfolio.ts` pelo mesmo motivo de `media-upload.ts`/`vitrine-upload.ts` (ver comentário lá).
 */

const BUCKET_ORIGEM = 'media'
const BUCKET_DESTINO = 'vitrine'
/* Quadrada o bastante pra grade de portfólio, generosa o bastante pra tela cheia num toque. */
const FORMATO = { largura: 1200, altura: 1200, ajuste: 'inside' as const }

/**
 * Copia uma foto do bucket privado `media` pro bucket público `vitrine`, reencodando (mesma
 * disciplina de `vitrine-upload.ts`: nunca serve o arquivo original de um bucket público, mesmo
 * que os bytes sejam idênticos — o pipeline de reencode é o único lugar que garante metadata
 * fora).
 *
 * Confere o consentimento NA HORA de publicar, não confia em nenhum estado que o chamador tenha
 * lido antes: o `image_use` pode ter sido revogado entre a tela carregar e o toque no botão.
 */
export async function publicarNoPortfolio(tenantId: string, mediaId: string): Promise<{ id: string; url: string }> {
  return withTenant(tenantId, async (db) => {
    const { data: foto, error: erroFoto } = await db
      .from('media')
      .select('id, client_id, storage_key, consent_id, kind, deleted_at')
      .eq('tenant_id', tenantId)
      .eq('id', mediaId)
      .maybeSingle()
    if (erroFoto) throw new AppError('INTERNAL', { cause: erroFoto })
    if (!foto || foto.deleted_at || foto.kind !== 'photo' || !foto.client_id) throw new AppError('NOT_FOUND', { message: 'Essa foto não existe mais.' })
    if (!foto.consent_id) {
      throw AppError.validacao({ consentId: 'Esta foto não tem autorização de uso de imagem — conceda antes de publicar.' })
    }

    const { data: consentimento, error: erroConsentimento } = await db
      .from('consents')
      .select('id')
      .eq('id', foto.consent_id)
      .eq('tenant_id', tenantId)
      .eq('kind', 'image_use')
      .eq('granted', true)
      .is('revoked_at', null)
      .maybeSingle()
    if (erroConsentimento) throw new AppError('INTERNAL', { cause: erroConsentimento })
    if (!consentimento) {
      throw AppError.validacao({ consentId: 'A autorização de uso de imagem desta cliente não está mais ativa.' })
    }

    const { data: original, error: erroDownload } = await db.storage.from(BUCKET_ORIGEM).download(foto.storage_key)
    if (erroDownload || !original) throw new AppError('INTERNAL', { cause: erroDownload })

    let processado: Buffer
    try {
      const bytes = Buffer.from(await original.arrayBuffer())
      processado = await sharp(bytes).resize(FORMATO.largura, FORMATO.altura, { fit: FORMATO.ajuste, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer()
    } catch {
      throw AppError.validacao({ file: 'Não foi possível processar essa imagem.' })
    }

    const storageKey = `${tenantId}/${randomUUID()}.webp`
    const { error: erroUpload } = await db.storage.from(BUCKET_DESTINO).upload(storageKey, processado, { contentType: 'image/webp', cacheControl: '31536000' })
    if (erroUpload) throw new AppError('INTERNAL', { cause: erroUpload })

    // Publicar de novo uma foto já publicada (duplo toque) não deve criar duas linhas — apaga a
    // cópia anterior antes de gravar a nova, mesmo padrão de `fazerUploadDaVitrine` trocando logo.
    const { data: anterior } = await db.from('portfolio_photos').select('id, storage_key').eq('tenant_id', tenantId).eq('source_media_id', mediaId).maybeSingle()

    const { data: linha, error: erroInsert } = await db
      .from('portfolio_photos')
      .insert({ tenant_id: tenantId, client_id: foto.client_id, source_media_id: mediaId, storage_key: storageKey })
      .select('id')
      .single()
    if (erroInsert) throw new AppError('INTERNAL', { cause: erroInsert })

    if (anterior) {
      await db.from('portfolio_photos').delete().eq('id', anterior.id)
      const { error: erroRemocao } = await db.storage.from(BUCKET_DESTINO).remove([anterior.storage_key])
      if (erroRemocao) {
        console.warn(JSON.stringify({ level: 'warn', event: 'portfolio_orfao_nao_removido', tenantId, chave: anterior.storage_key }))
      }
    }

    const origem = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? ''
    return { id: linha.id, url: `${origem}/storage/v1/object/public/${BUCKET_DESTINO}/${storageKey}` }
  })
}
