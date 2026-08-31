import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { registrarAcessoAoCofre } from '@/server/services/cofre-trilha'
import { despublicarDoPortfolio } from '@/server/services/portfolio'

const BUCKET = 'media'
const URL_ASSINADA_SEGUNDOS = 5 * 60

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

/**
 * Regra 11 do CLAUDE.md: nunca delete de verdade, use estado. `deleted_at` some da ficha SEM
 * apagar o arquivo do bucket nem a trilha — o mesmo raciocínio de agendamento e movimento de
 * estoque, aplicado a foto de cliente.
 *
 * Do portfólio PÚBLICO, sim, apaga de verdade (TICKET-115): se a foto original saiu porque
 * alguém pediu (a cliente, um erro de upload), a cópia visível no site não pode continuar lá só
 * porque o soft delete original não mexe em `portfolio_photos`.
 */
export async function deletarMedia(tenantId: string, mediaId: string): Promise<void> {
  return withTenant(tenantId, async (db) => {
    const { error } = await db
      .from('media')
      .update({ deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', mediaId)
      .is('deleted_at', null)
    if (error) throw new AppError('INTERNAL', { cause: error })
    // Idempotente de propósito: apagar de novo uma foto já apagada (duplo toque, aba dupla)
    // não pode virar 404 — zero linhas afetadas aqui só quer dizer "já estava assim".
  }).then(() => despublicarDoPortfolio(tenantId, mediaId))
}

export type LinhaMedia = { id: string; phase: string | null; createdAt: string; publicada: boolean }

/**
 * `publicada`: TICKET-115. Join contra `portfolio_photos` (nunca mais de uma linha por
 * `source_media_id` — `publicarNoPortfolio` apaga a anterior antes de gravar de novo), pra
 * `fotos.tsx` saber se mostra "Publicar no site" ou "Publicado · remover" sem outra ida ao banco.
 */
export async function listarMediaDoCliente(tenantId: string, clientId: string): Promise<LinhaMedia[]> {
  return withTenant(tenantId, async (db) => {
    const { data, error } = await db
      .from('media')
      .select('id, phase, created_at, portfolio_photos ( id )')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('kind', 'photo')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) throw new AppError('INTERNAL', { cause: error })
    return (data ?? []).map((m) => ({
      id: m.id,
      phase: m.phase,
      createdAt: m.created_at,
      publicada: Array.isArray(m.portfolio_photos) ? m.portfolio_photos.length > 0 : m.portfolio_photos !== null,
    }))
  })
}

/**
 * §critério do TICKET-051: "revogar imagem esconde a foto do portfólio
 * imediatamente" — só entra aqui quem tem `image_use` concedido e ATIVO
 * (`consents.revoked_at is null`) através do `consent_id` da própria foto.
 * Foto sem `consent_id` (uso clínico interno, não portfólio) nunca aparece
 * aqui — é o oposto do padrão de `listarMediaDoCliente`, de propósito.
 */
export async function mediaParaPortfolio(tenantId: string, clientId: string): Promise<Omit<LinhaMedia, 'publicada'>[]> {
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
