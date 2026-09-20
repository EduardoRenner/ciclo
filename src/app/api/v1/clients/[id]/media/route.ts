import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { listarMediaDoCliente } from '@/server/services/media'
import { EsquemaUploadMedia, fazerUploadMedia } from '@/server/services/media-upload'
import { AppError } from '@/server/http/errors'
import { lerJson } from '@/server/http/body'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { UUID } from '@/core/text/uuid'

type Ctx = { params: Promise<{ id: string }> }
const TAMANHO_MAXIMO = 10 * 1024 * 1024

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const id = await idValidado(params)
  return listarMediaDoCliente(ctx.tenantId, id)
})

/**
 * `POST .../media multipart → strip EXIF, bucket privado` (§2.7).
 *
 * Achado em 2026-09-18: fora da fila offline (que só embala JSON), o único jeito de repetir esta
 * chamada era o toque duplo humano — já coberto pelo botão desabilitado durante o envio. O que
 * faltava é o cenário que Idempotency-Key existe para cobrir: rede ruim que derruba a RESPOSTA
 * depois de a escrita já ter acontecido, e a pessoa tenta de novo vendo "falhou". Sem chave, cada
 * tentativa cria uma foto nova — a mesma imagem duplicada na lista, sem dedupe nenhum.
 *
 * Risco de trocar o client (RLS→service_role) não se aplica aqui: `fazerUploadMedia` já resolve o
 * próprio `db` via `withTenant` por dentro, e esta rota nunca cria um `db` seu — `comIdempotencia`
 * só embrulha a chamada, sem mudar quem fala com o banco.
 */
export const POST = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('file')
  if (!(arquivo instanceof File)) throw AppError.validacao({ file: 'Envie uma imagem.' })
  if (arquivo.size > TAMANHO_MAXIMO) throw AppError.validacao({ file: 'Arquivo maior que 10MB.' })

  const appointmentIdBruto = form?.get('appointmentId')
  const phaseBruto = form?.get('phase')
  const consentIdBruto = form?.get('consentId')

  const entrada = lerJson(EsquemaUploadMedia, {
    clientId: id,
    appointmentId: typeof appointmentIdBruto === 'string' && appointmentIdBruto ? appointmentIdBruto : null,
    phase: typeof phaseBruto === 'string' && phaseBruto ? phaseBruto : null,
    consentId: typeof consentIdBruto === 'string' && consentIdBruto ? consentIdBruto : null,
  })

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/media` }, () =>
    fazerUploadMedia(ctx.tenantId, entrada, { buffer, createdBy: ctx.sessao.userId }),
  )
})
