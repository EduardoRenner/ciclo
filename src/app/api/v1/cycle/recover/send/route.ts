import { writeAudit } from '@/server/audit/write'
import { exigirPermissao } from '@/server/auth/rbac'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { exigirCapacidade } from '@/server/services/planos'
import { EsquemaEnviarRecuperar, enviarParaRecuperar } from '@/server/services/recuperar-receita'
import { lerCorpo } from '@/server/http/body'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { comIdempotencia } from '@/server/http/idempotency'

export const POST = rota(async (req, _ctx, requestId) => {
  const ctx = await contextoAtual(req)
  exigirPermissao(ctx.papel, 'client:read')

  const entrada = await lerCorpo(req, EsquemaEnviarRecuperar)
  const db = await criarClienteDoUsuario()

  // §D.2 do plano de monetização: o grátis MOSTRA quem sumiu e quanto vale — o que ele não dá é
  // a alavanca de chamar todo mundo de uma vez. Mandar um a um continua livre, para sempre, e é
  // por isso que o teto é em `> 1` e não em "enviar".
  //
  // No servidor porque §L.1: sumir com o botão de lote na tela não impede ninguém de montar a
  // requisição com 40 itens na mão.
  if (entrada.items.length > 1) await exigirCapacidade(db, ctx.tenantId, 'envio_em_lote')

  const { data: tenant, error } = await db.from('tenants').select('timezone').eq('id', ctx.tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  const timezone = tenant?.timezone ?? 'America/Sao_Paulo'

  const resultado = await comIdempotencia(req, { tenantId: ctx.tenantId, endpoint: '/api/v1/cycle/recover/send' }, () =>
    enviarParaRecuperar(db, ctx.tenantId, timezone, entrada),
  )

  await writeAudit(
    {
      tenantId: ctx.tenantId,
      actorId: ctx.sessao.userId,
      actorRole: ctx.papel,
      action: 'cycle.recover.send',
      entity: 'client_cycles',
      after: resultado,
      requestId,
    },
    req,
  )

  return resultado
})
