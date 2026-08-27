import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { listarMediaDoCliente } from '@/server/services/media'
import { EsquemaUploadMedia, fazerUploadMedia } from '@/server/services/media-upload'
import { AppError } from '@/server/http/errors'
import { lerJson } from '@/server/http/body'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TAMANHO_MAXIMO = 10 * 1024 * 1024

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const id = await idValidado(params)
  return listarMediaDoCliente(ctx.tenantId, id)
})

/** `POST .../media multipart → strip EXIF, bucket privado` (§2.7). */
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

  const entrada = lerJson(EsquemaUploadMedia, {
    clientId: id,
    appointmentId: typeof appointmentIdBruto === 'string' && appointmentIdBruto ? appointmentIdBruto : null,
    phase: typeof phaseBruto === 'string' && phaseBruto ? phaseBruto : null,
  })

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  return fazerUploadMedia(ctx.tenantId, entrada, { buffer, createdBy: ctx.sessao.userId })
})
