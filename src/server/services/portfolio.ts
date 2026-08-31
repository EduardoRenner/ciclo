import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'

/**
 * `docs/35-FOTOS-CONSENTIMENTO-PLANO.md`, TICKET-115. Este arquivo é o lado LEVE (sem `sharp`).
 * `publicarNoPortfolio` (que reencoda e sobe pro bucket `vitrine`) mora em `portfolio-upload.ts`,
 * separado pelo mesmo motivo de `media-upload.ts`/`vitrine-upload.ts`: um import daqui até o
 * `sharp` arrastaria o libvips (19,2 MB) pra qualquer rota que só precisasse tirar uma foto do ar.
 */

/**
 * Tira do site. Diferente de `deletarMedia` (foto original, soft delete — regra 11 do CLAUDE.md):
 * `portfolio_photos` é uma CÓPIA de exibição, sem histórico de negócio a preservar — mesmo
 * raciocínio de `removerDaVitrine` (logo/capa). Apaga a linha e o arquivo do bucket `vitrine`.
 */
export async function despublicarDoPortfolio(tenantId: string, mediaId: string): Promise<void> {
  return withTenant(tenantId, async (db) => {
    const { data: linha, error: erroLeitura } = await db
      .from('portfolio_photos')
      .select('id, storage_key')
      .eq('tenant_id', tenantId)
      .eq('source_media_id', mediaId)
      .maybeSingle()
    if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })
    if (!linha) return // já não estava publicada — idempotente, mesmo padrão de deletarMedia

    const { error: erroDelete } = await db.from('portfolio_photos').delete().eq('id', linha.id).eq('tenant_id', tenantId)
    if (erroDelete) throw new AppError('INTERNAL', { cause: erroDelete })

    const { error: erroStorage } = await db.storage.from('vitrine').remove([linha.storage_key])
    if (erroStorage) {
      console.warn(JSON.stringify({ level: 'warn', event: 'portfolio_orfao_nao_removido', tenantId, chave: linha.storage_key }))
    }
  })
}
