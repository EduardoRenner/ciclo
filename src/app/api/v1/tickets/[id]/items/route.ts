import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { adicionarItemComanda, EsquemaItemComanda } from '@/server/services/comanda'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'
import { exigirModulo } from '@/server/services/planos'

type Ctx = { params: Promise<{ id: string }> }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const POST = rota(async (req, params, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'comanda:own')

  const { id: ticketId } = await (params as Ctx).params
  if (!UUID.test(ticketId)) throw new AppError('NOT_FOUND', { message: 'Essa comanda não existe mais.' })

  const entrada = await lerCorpo(req, EsquemaItemComanda)
  const db = await criarClienteDoUsuario()

  /*
   * §L.2.1: o módulo vale no SERVIDOR, e só na ESCRITA. Vem antes da idempotência pelo mesmo
   * motivo que o limite em `professionals/route.ts` — repetir uma requisição que já era proibida
   * tem que continuar sendo proibida.
   *
   * A trava de `register` fica AQUI, em lançar item, e deliberadamente NÃO em fechar nem em
   * cancelar comanda. `concluirAgendamento()` cria a comanda sozinho ao concluir um atendimento,
   * que é ação do plano grátis — travar o fechamento faria o sistema gerar um estado que o dono
   * não pode encerrar, e isso não é pressão de upgrade, é armadilha. A regra 5.1 diz que cair de
   * plano limita o que dá para FAZER e nunca esconde o que já existe; prender o que já existe é a
   * mesma violação pela porta dos fundos. Usar a comanda como caixa (lançar produto, item extra)
   * é o que o Essencial vende — e é só isso que trava.
   */
  await exigirModulo(db, ctx.tenantId, 'register')

  const item = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: `/api/v1/tickets/${ticketId}/items` }, () =>
    adicionarItemComanda(db, ctx.tenantId, ticketId, entrada),
  )

  await writeAudit(
    { tenantId: ctx.tenantId, actorId: ctx.sessao.userId, actorRole: ctx.papel, action: 'ticket.item.add', entity: 'ticket_items', entityId: item.id, after: item, requestId },
    req,
  )

  return item
})
