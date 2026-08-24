import { randomUUID } from 'node:crypto'

import sharp from 'sharp'
import { z } from 'zod'

import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { registrarAcessoAoCofre } from '@/server/services/cofre-trilha'

const BUCKET = 'media'
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024
const URL_ASSINADA_SEGUNDOS = 5 * 60

export const EsquemaUploadMedia = z.object({
  clientId: z.uuid(),
  appointmentId: z.uuid().nullish(),
  phase: z.enum(['before', 'after', 'reference']).nullish(),
})
type EntradaUploadMedia = z.infer<typeof EsquemaUploadMedia>

/**
 * TICKET-052. `§8`/`§9`: strip de EXIF por reencode — `sharp` só preserva
 * metadata se `.withMetadata()` for chamado, então não chamando, o EXIF
 * (que carrega GPS de onde a foto foi tirada) já não sobrevive. `.rotate()`
 * sem argumento é o auto-orient a partir do EXIF de orientação **antes** de
 * descartar o resto — sem isso a foto vira de lado (o EXIF de orientação é
 * o único pedaço que precisa ser lido, nunca gravado de volta).
 *
 * `storage_key` é `{tenantId}/{uuid}.webp` — aleatório, nunca
 * `{slug}/foto-1.jpg` (FAQ/§9: "nunca previsível").
 */
export async function fazerUploadMedia(
  tenantId: string,
  entrada: EntradaUploadMedia,
  arquivo: { buffer: Buffer; createdBy: string | null },
) {
  if (arquivo.buffer.length > TAMANHO_MAX_BYTES) throw AppError.validacao({ file: 'Arquivo maior que 10MB.' })

  let processado: Buffer
  try {
    processado = await sharp(arquivo.buffer).rotate().webp({ quality: 82 }).toBuffer()
  } catch {
    // magic bytes ruins (não é imagem de verdade) derrubam o sharp com um erro nativo —
    // vira 422, não 500: a pessoa mandou um arquivo errado, não é bug do servidor.
    throw AppError.validacao({ file: 'Não foi possível processar essa imagem.' })
  }
  const metadados = await sharp(processado).metadata()

  const storageKey = `${tenantId}/${randomUUID()}.webp`

  return withTenant(tenantId, async (db) => {
    const { error: erroUpload } = await db.storage.from(BUCKET).upload(storageKey, processado, { contentType: 'image/webp', cacheControl: '0' })
    if (erroUpload) throw new AppError('INTERNAL', { cause: erroUpload })

    const { data, error } = await db
      .from('media')
      .insert({
        tenant_id: tenantId,
        client_id: entrada.clientId,
        appointment_id: entrada.appointmentId ?? null,
        storage_key: storageKey,
        kind: 'photo',
        phase: entrada.phase ?? null,
        width: metadados.width ?? null,
        height: metadados.height ?? null,
        bytes: processado.length,
        created_by: arquivo.createdBy,
      })
      .select('*')
      .single()
    if (error) throw new AppError('INTERNAL', { cause: error })
    return data
  })
}

export type UrlAssinada = { url: string; expiresInSeconds: number }

/**
 * `§9`: "cada geração de URL registra em vault_access_log", `Cache-Control:
 * private, no-store` — quem serve o arquivo pela URL assinada é o Storage do
 * Supabase, então o header vai como parâmetro do `createSignedUrl`.
 */
export async function urlAssinadaMedia(tenantId: string, mediaId: string, quem: { actorId: string | null; ip: string | null; userAgent: string | null }): Promise<UrlAssinada> {
  return withTenant(tenantId, async (db) => {
    const { data: registro, error } = await db.from('media').select('storage_key, client_id').eq('tenant_id', tenantId).eq('id', mediaId).is('deleted_at', null).maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!registro || !registro.client_id) throw new AppError('NOT_FOUND', { message: 'Essa foto não existe mais.' })

    const { data: assinada, error: erroUrl } = await db.storage.from(BUCKET).createSignedUrl(registro.storage_key, URL_ASSINADA_SEGUNDOS, {
      download: false,
      transform: undefined,
    })
    if (erroUrl || !assinada) throw new AppError('INTERNAL', { cause: erroUrl })

    await registrarAcessoAoCofre(db, tenantId, registro.client_id, 'read', quem)

    return { url: assinada.signedUrl, expiresInSeconds: URL_ASSINADA_SEGUNDOS }
  })
}

export type LinhaMedia = { id: string; phase: string | null; createdAt: string }

export async function listarMediaDoCliente(tenantId: string, clientId: string): Promise<LinhaMedia[]> {
  return withTenant(tenantId, async (db) => {
    const { data, error } = await db
      .from('media')
      .select('id, phase, created_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('kind', 'photo')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) throw new AppError('INTERNAL', { cause: error })
    return (data ?? []).map((m) => ({ id: m.id, phase: m.phase, createdAt: m.created_at }))
  })
}

/**
 * §critério do TICKET-051: "revogar imagem esconde a foto do portfólio
 * imediatamente" — só entra aqui quem tem `image_use` concedido e ATIVO
 * (`consents.revoked_at is null`) através do `consent_id` da própria foto.
 * Foto sem `consent_id` (uso clínico interno, não portfólio) nunca aparece
 * aqui — é o oposto do padrão de `listarMediaDoCliente`, de propósito.
 */
export async function mediaParaPortfolio(tenantId: string, clientId: string): Promise<LinhaMedia[]> {
  return withTenant(tenantId, async (db) => {
    const { data, error } = await db
      .from('media')
      .select('id, phase, created_at, consents ( revoked_at )')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('kind', 'photo')
      .is('deleted_at', null)
      .not('consent_id', 'is', null)
      .order('created_at', { ascending: false })
    if (error) throw new AppError('INTERNAL', { cause: error })

    return (data ?? [])
      .filter((m) => (m.consents as { revoked_at: string | null } | null)?.revoked_at == null)
      .map((m) => ({ id: m.id, phase: m.phase, createdAt: m.created_at }))
  })
}
