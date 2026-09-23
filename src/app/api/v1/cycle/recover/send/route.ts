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

  /*
    §D.2 do plano de monetização dizia "mandar um a um continua livre, para sempre" — escrito
    quando esta rota era o ÚNICO jeito de avisar alguém. Revisto em 2026-09-23 (`docs/82` §11):
    hoje "Chamar" (o WhatsApp DO PRÓPRIO DONO, via `wa.me`, sem depender de credencial nenhuma) é
    o caminho grátis padrão, um por um, para sempre — e ele não passa por aqui. Esta rota manda
    pelo número da Meta que o CICLO paga (categoria marketing, ~R$0,31/mensagem), então TODO envio
    por ela — um cliente ou quarenta — é a alavanca paga de "avisar pelo sistema"/"todo mundo de
    uma vez". Nenhuma contagem: a trava vale sempre.

    No servidor porque §L.1: sumir com o botão de lote na tela não impede ninguém de montar a
    requisição na mão.
  */
  await exigirCapacidade(db, ctx.tenantId, 'envio_em_lote')

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
