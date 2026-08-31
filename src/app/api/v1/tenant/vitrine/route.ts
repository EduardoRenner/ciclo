import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { EsquemaUploadVitrine, fazerUploadDaVitrine, removerDaVitrine } from '@/server/services/vitrine-upload'

/**
 * Logo e capa da página pública.
 *
 * Rota própria, e não mais um campo no `PATCH /api/v1/tenant`, porque o corpo aqui é
 * `multipart/form-data` e aquela rota é JSON — misturar as duas obrigaria a rota de texto a
 * carregar o caminho de import do `sharp` (19,2 MB), que é exatamente o que
 * `sharp-so-onde-precisa.test.ts` existe para impedir.
 *
 * `tenant:update` só o dono tem (mesma permissão do PATCH do tenant, e mesma política de RLS
 * `tenants_update` como segunda camada): trocar a marca da página pública é decisão de dono, não
 * de quem atende.
 *
 * Sem `Idempotency-Key`: cada upload gera uma chave nova (`{tenantId}/{uuid}.webp`) e substitui a
 * anterior, então repetir a requisição é idempotente por construção — a segunda chamada
 * simplesmente vira a imagem vigente, sem duplicar registro em lugar nenhum.
 */
const TAMANHO_MAXIMO = 2 * 1024 * 1024

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('file')
  if (!(arquivo instanceof File)) throw AppError.validacao({ file: 'Escolha uma imagem.' })
  if (arquivo.size > TAMANHO_MAXIMO) throw AppError.validacao({ file: 'Imagem maior que 2MB. Tente uma menor.' })

  const tipoBruto = form?.get('tipo')
  const { tipo } = EsquemaUploadVitrine.parse({ tipo: typeof tipoBruto === 'string' ? tipoBruto : undefined })

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const resultado = await fazerUploadDaVitrine(ctx.tenantId, { tipo }, { buffer })

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.vitrine.upload',
      entity: 'tenants',
      entityId: ctx.tenantId,
      after: { tipo, key: resultado.key },
      requestId,
    },
    req,
  )

  return resultado
})

export const DELETE = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'tenant:update')

  const tipoBruto = new URL(req.url).searchParams.get('tipo')
  const { tipo } = EsquemaUploadVitrine.parse({ tipo: tipoBruto ?? undefined })

  await removerDaVitrine(ctx.tenantId, tipo)

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.vitrine.remove',
      entity: 'tenants',
      entityId: ctx.tenantId,
      before: { tipo },
      requestId,
    },
    req,
  )

  return { ok: true }
})
