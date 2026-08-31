import { randomUUID } from 'node:crypto'

import sharp from 'sharp'
import { z } from 'zod'

import { withTenant } from '@/server/db/with-tenant'
import { AppError } from '@/server/http/errors'

/**
 * Upload de foto mora sozinho aqui **por causa do tamanho do `sharp`**, não por organização
 * (`docs/28-LATENCIA-DE-CLIQUE-PLANO.md` §7).
 *
 * O `sharp` carrega `@img/*` — o libvips nativo, **19,2 MB**. Enquanto esta função morava em
 * `media.ts`, junto das consultas, qualquer coisa que importasse aquele arquivo arrastava o
 * binário: `admin/hoje/page.tsx` → `crm.ts` → `media.ts` → `sharp`. E `crm.ts` importa de lá uma
 * função que é **só um select** (`listarMediaDoCliente`). Resultado medido em 27/08: `/admin/hoje`,
 * a tela inicial do painel, era empacotada com **23,4 MB** contra uma mediana de 1,8 MB por rota,
 * e media 1.870 ms de cold start.
 *
 * Duas tentativas anteriores estão registradas para não se repetirem:
 *
 * 1. `import()` dinâmico dentro da função. Tira o custo de *carregar* o binário, mas não o de
 *    *empacotar* — o tracing do Next segue `import()` também, e com razão: ele não sabe se a
 *    chamada vai acontecer.
 * 2. `outputFileTracingExcludes` no `next.config.ts`. As chaves são glob, e `[id]` em glob é
 *    classe de caractere, não segmento dinâmico — uma chave com colchete tirou o `sharp` de
 *    **todas** as rotas, inclusive desta, o que quebraria o envio de foto em produção com
 *    módulo não encontrado. Sem colchete, nenhuma chave casava com nada.
 *
 * A separação de arquivo resolve por construção: quem só consulta importa `media.ts` e não tem
 * caminho nenhum até o `sharp`. Por isso o `import` aqui volta a ser estático — este arquivo é
 * importado exatamente por quem processa imagem.
 *
 * **Não mova nada daqui para `media.ts`.** O teste `tests/unit/server/sharp-so-onde-precisa.test.ts`
 * quebra se alguém religar os dois lados.
 */

const BUCKET = 'media'
const TAMANHO_MAX_BYTES = 10 * 1024 * 1024

export const EsquemaUploadMedia = z.object({
  clientId: z.uuid(),
  appointmentId: z.uuid().nullish(),
  phase: z.enum(['before', 'after', 'reference']).nullish(),
  /*
   * `docs/35-FOTOS-CONSENTIMENTO-PLANO.md`, TICKET-114: até aqui `media.consent_id` existia na
   * coluna desde a origem mas nenhum caminho do app escrevia nela — `mediaParaPortfolio`
   * (filtro por `image_use` ativo) nunca tinha o que achar. A validação de que o consentimento
   * é do MESMO tenant/cliente e está ativo é de `fazerUploadMedia`, não deste schema: aqui é só
   * formato.
   */
  consentId: z.uuid().nullish(),
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
    /*
     * Confere ANTES de subir o arquivo, não depois: um `consentId` de outro cliente (ou
     * revogado, ou de outro tipo) não pode gravar `media.consent_id` — seria uma foto elegível
     * pra portfólio sem consentimento de uso de imagem de verdade por trás. Mesma disciplina de
     * "nunca confiar no id vindo do corpo" que `resolverCliente` já aplica pra `referredBy`: um
     * id inválido vira `null` em silêncio, não erro — a foto ainda sobe, só sem o vínculo.
     */
    let consentId: string | null = null
    if (entrada.consentId) {
      const { data: consentimento } = await db
        .from('consents')
        .select('id')
        .eq('id', entrada.consentId)
        .eq('tenant_id', tenantId)
        .eq('client_id', entrada.clientId)
        .eq('kind', 'image_use')
        .eq('granted', true)
        .is('revoked_at', null)
        .maybeSingle()
      consentId = consentimento?.id ?? null
    }

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
        consent_id: consentId,
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
