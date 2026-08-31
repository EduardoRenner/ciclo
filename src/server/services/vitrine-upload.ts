import { randomUUID } from 'node:crypto'

import sharp from 'sharp'
import { z } from 'zod'

import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'
import { atualizarTenant, lerSite } from '@/server/services/site'

/**
 * Upload de logo e capa da página pública.
 *
 * **Arquivo separado pelo mesmo motivo de `media-upload.ts`, e a regra vale igual aqui:** o
 * `sharp` carrega 19,2 MB de libvips, e qualquer módulo com caminho de import até ele arrasta o
 * binário para o pacote da rota. A página pública do salão (`/[slug]`) é justamente a que mais
 * precisa ser leve — é o link que a cliente abre no 4G. Por isso ela lê a chave de
 * `settings.site` e monta o endereço com `core/text/vitrine.ts`, que é puro; nada nela chega
 * aqui. Ver `tests/unit/server/sharp-so-onde-precisa.test.ts`, que anda o grafo de imports.
 *
 * **Nunca importe este arquivo de `site.ts`.** A dependência é de mão única: aqui importamos
 * `lerSite`/`salvarSite` para gravar a chave; o contrário fecharia o ciclo e ligaria o `sharp` em
 * toda tela que lê configuração de site — inclusive a pública.
 */

/** Bucket PÚBLICO da migration 0051 — o privado é o `media`, que guarda foto de cliente. */
const BUCKET = 'vitrine'
const TAMANHO_MAX_BYTES = 2 * 1024 * 1024

/**
 * Logo e capa têm proporções e usos diferentes, então cada uma tem seu teto:
 *
 * - `logo` entra em espaço pequeno e redondo/quadrado na página; 512px de lado é folgado até em
 *   tela de alta densidade, e mantém o arquivo na casa das dezenas de KB.
 * - `cover` é a faixa do topo, larga; 1600px cobre desktop sem virar um download de 1 MB no
 *   celular. `withoutEnlargement` evita esticar uma imagem pequena e entregar borrão.
 */
const FORMATOS = {
  logo: { largura: 512, altura: 512, ajuste: 'inside' as const },
  cover: { largura: 1600, altura: 600, ajuste: 'cover' as const },
}

export const EsquemaUploadVitrine = z.object({
  tipo: z.enum(['logo', 'cover']),
})
export type TipoDeVitrine = z.infer<typeof EsquemaUploadVitrine>['tipo']

/**
 * Reencoda para WebP e sobe. O reencode não é só compressão: `sharp` só preserva metadata se
 * `.withMetadata()` for chamado, então não chamando, o EXIF já não sobrevive — mesma defesa da
 * `media-upload.ts`. Aqui isso importa menos (é logo, não foto tirada no celular), mas a logo
 * pode ter sido exportada de um app que carimba dado do autor, e o custo de não vazar é zero.
 *
 * `.rotate()` sem argumento é o auto-orient a partir do EXIF de orientação, aplicado ANTES de
 * descartar o resto — sem ele uma capa fotografada no celular sobe deitada.
 */
export async function fazerUploadDaVitrine(
  tenantId: string,
  entrada: { tipo: TipoDeVitrine },
  arquivo: { buffer: Buffer },
): Promise<{ key: string }> {
  if (arquivo.buffer.length > TAMANHO_MAX_BYTES) {
    throw AppError.validacao({ file: 'Imagem maior que 2MB. Tente uma menor.' })
  }

  const formato = FORMATOS[entrada.tipo]

  let processado: Buffer
  try {
    processado = await sharp(arquivo.buffer)
      .rotate()
      .resize(formato.largura, formato.altura, { fit: formato.ajuste, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    // magic bytes ruins (não é imagem de verdade) derrubam o sharp com erro nativo — vira 422,
    // não 500: a pessoa mandou arquivo errado, não é bug do servidor.
    throw AppError.validacao({ file: 'Não foi possível processar essa imagem.' })
  }

  const storageKey = `${tenantId}/${randomUUID()}.webp`

  return withTenant(tenantId, async (db) => {
    const { error: erroUpload } = await db.storage
      .from(BUCKET)
      .upload(storageKey, processado, { contentType: 'image/webp', cacheControl: '31536000' })
    if (erroUpload) throw new AppError('INTERNAL', { cause: erroUpload })

    const { data: tenant, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

    /*
     * A chave anterior é apagada DEPOIS de a nova estar gravada em `settings`, nunca antes: se o
     * processo morrer no meio, sobra um arquivo órfão no bucket (custo de centavos, invisível) em
     * vez de uma página com logo quebrada apontando para um arquivo que não existe mais.
     */
    const siteAtual = lerSite(tenant?.settings)
    const chaveAntiga = entrada.tipo === 'logo' ? siteAtual.logoKey : siteAtual.coverKey

    // `atualizarTenant` faz o merge do namespace `site` — passar só a chave nova preserva
    // tagline, sobre, WhatsApp, Instagram e cor.
    await atualizarTenant(db, tenantId, { site: entrada.tipo === 'logo' ? { logoKey: storageKey } : { coverKey: storageKey } })

    if (chaveAntiga && chaveAntiga !== storageKey) {
      const { error: erroRemocao } = await db.storage.from(BUCKET).remove([chaveAntiga])
      // Falha ao limpar o arquivo velho não pode derrubar um upload que já deu certo — a imagem
      // nova já está no ar e é ela que a página mostra.
      if (erroRemocao) {
        console.warn(JSON.stringify({ level: 'warn', event: 'vitrine_orfa_nao_removida', tenantId, chave: chaveAntiga }))
      }
    }

    return { key: storageKey }
  })
}

/** Tira a imagem da página. O arquivo sai do bucket junto — não há histórico a preservar aqui. */
export async function removerDaVitrine(tenantId: string, tipo: TipoDeVitrine): Promise<void> {
  return withTenant(tenantId, async (db) => {
    const { data: tenant, error } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })

    const site = lerSite(tenant?.settings)
    const chave = tipo === 'logo' ? site.logoKey : site.coverKey
    if (!chave) return

    await atualizarTenant(db, tenantId, { site: tipo === 'logo' ? { logoKey: null } : { coverKey: null } })
    await db.storage.from(BUCKET).remove([chave])
  })
}
