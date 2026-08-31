import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { EsquemaUploadDeEntidade, fazerUploadDaEntidade, removerDaEntidade } from '@/server/services/vitrine-upload'

/**
 * Foto de UM serviço ou de UM profissional (a logo e a capa do negócio ficam na rota irmã).
 *
 * A permissão sai do tipo, não é fixa em `tenant:update`, e isso reproduz a tabela do RBAC em vez
 * de inventar uma regra nova: `service:*` está no `manager` (§3.3), então quem cuida do catálogo
 * troca a foto de um serviço; `professional` só tem `read` para o manager, então trocar o rosto de
 * alguém da equipe fica com o dono. É a assimetria que já existe — foto de pessoa é sobre a
 * pessoa, catálogo é sobre o negócio.
 *
 * Mesma rota para os dois tipos porque o corpo, o processamento e as guardas são idênticos — o que
 * muda é uma coluna. Duas rotas seriam duas cópias do mesmo tratamento de `multipart`, e é assim
 * que elas divergem depois.
 */
const TAMANHO_MAXIMO = 2 * 1024 * 1024

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)

  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('file')
  if (!(arquivo instanceof File)) throw AppError.validacao({ file: 'Escolha uma imagem.' })
  if (arquivo.size > TAMANHO_MAXIMO) throw AppError.validacao({ file: 'Imagem maior que 2MB. Tente uma menor.' })

  const tipoBruto = form?.get('tipo')
  const idBruto = form?.get('id')
  const entrada = EsquemaUploadDeEntidade.parse({
    tipo: typeof tipoBruto === 'string' ? tipoBruto : undefined,
    id: typeof idBruto === 'string' ? idBruto : undefined,
  })

  exigirPermissao(ctx.papel, entrada.tipo === 'service' ? 'service:update' : 'professional:update')

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const resultado = await fazerUploadDaEntidade(ctx.tenantId, entrada, { buffer })

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.vitrine.entidade.upload',
      entity: entrada.tipo === 'service' ? 'services' : 'professionals',
      entityId: entrada.id,
      after: { key: resultado.key },
      requestId,
    },
    req,
  )

  return resultado
})

export const DELETE = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)

  const url = new URL(req.url)
  const entrada = EsquemaUploadDeEntidade.parse({
    tipo: url.searchParams.get('tipo') ?? undefined,
    id: url.searchParams.get('id') ?? undefined,
  })

  exigirPermissao(ctx.papel, entrada.tipo === 'service' ? 'service:update' : 'professional:update')

  await removerDaEntidade(ctx.tenantId, entrada.tipo, entrada.id)

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'tenant.vitrine.entidade.remove',
      entity: entrada.tipo === 'service' ? 'services' : 'professionals',
      entityId: entrada.id,
      requestId,
    },
    req,
  )

  return { ok: true }
})
