import { ipDe } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { exigirAal2 } from '@/server/auth/session'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { withTenant } from '@/server/db/with-tenant'
import { exigirModulo } from '@/server/services/planos'
import { abrirFicha, EsquemaSalvarVault, salvarRespostas } from '@/server/services/anamnese'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  return id
}

/** §2.7: `GET .../vault 🔐 AAL2 → descriptografa e registra acesso`. */
export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'vault:own')
  const sessao = await exigirAal2()

  const id = await idValidado(params)

  // `withTenant` e não o cliente do usuário: a `0077` tirou `ciphertext`/`iv`/`auth_tag`/
  // `alert_label` do `grant select` de `authenticated`. A permissão e o AAL2 já foram conferidos
  // acima — o service_role entra DEPOIS da porta, nunca no lugar dela.
  const ficha = await withTenant(ctx.tenantId, (db, tenantId) =>
    abrirFicha(db, tenantId, id, {
      actorId: sessao.userId,
      ip: ipDe(req),
      userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
    }),
  )
  if (!ficha) throw new AppError('NOT_FOUND', { message: 'Essa ficha ainda não tem anamnese preenchida.' })
  return ficha
})

export const PUT = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'vault:own')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaSalvarVault)
  const db = await criarClienteDoUsuario()

  // §L.2.1: anamnese é módulo do Avançado. Trava só a ESCRITA — o GET acima segue liberado, e
  // isso não é descuido: a regra 5.1 é inviolável, e ficha de saúde já preenchida é o tipo de
  // dado que NUNCA pode sumir por causa de plano. Quem desce de degrau continua abrindo o que
  // registrou (com AAL2 e trilha, como sempre); o que trava é gravar resposta nova.
  await exigirModulo(db, ctx.tenantId, 'health_records')

  return comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/vault` }, () =>
    salvarRespostas(db, ctx.tenantId, id, entrada),
  )
})
