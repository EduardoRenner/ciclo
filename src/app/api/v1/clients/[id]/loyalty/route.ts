import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { EsquemaPontos, extratoDePontos, lancarPontos } from '@/server/services/fidelidade'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function idValidado(ctx: unknown): Promise<string> {
  const { id } = await (ctx as Ctx).params
  if (!UUID.test(id)) throw new AppError('NOT_FOUND', { message: 'Essa ficha não está mais na sua lista.' })
  return id
}

export const GET = rota(async (req, params) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const id = await idValidado(params)
  const db = await criarClienteDoUsuario()
  return extratoDePontos(db, ctx.tenantId, id)
})

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:update')

  const id = await idValidado(params)
  const entrada = await lerCorpo(req, EsquemaPontos)
  const db = await criarClienteDoUsuario()

  /*
   * §L.2.1: o módulo vale no SERVIDOR, e só na ESCRITA. Ler o extrato continua liberado — o que
   * trava é lançar ponto novo.
   *
   * E só ponto NOVO mesmo: `points < 0` é resgate (`lancarPontos` trata os dois casos, e recusa
   * resgate que deixaria saldo negativo). Bloquear resgate junto não cobraria do dono do salão —
   * cobraria da cliente dele, que juntou ponto sob uma promessa e ouviria "não dá para usar"
   * porque o salão mudou de plano. A regra 5.1 protege o que já existe, e saldo acumulado é
   * exatamente isso.
   */
  if (entrada.points > 0) await exigirModulo(db, ctx.tenantId, 'loyalty')

  const lancamento = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/clients/${id}/loyalty` }, () =>
    lancarPontos(db, ctx.tenantId, id, ctx.sessao.userId, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'loyalty.entry',
      entity: 'loyalty_entries',
      entityId: lancamento.id,
      after: lancamento,
      requestId,
    },
    req,
  )

  return lancamento
})
