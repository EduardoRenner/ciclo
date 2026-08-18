import { withNovoTenant } from '@/server/db/with-tenant'
import { confirmarAgendamento } from '@/server/services/agendamentos'
import { verificarTokenConfirmacao } from '@/server/services/confirmacao-token'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ token: string }> }

/**
 * "Botão confirma sem login" (TICKET-030). O token já prova que quem clicou
 * recebeu o link (mandado só para o telefone/e-mail da cliente) — não
 * precisa de sessão para confirmar o próprio horário.
 */
export const POST = rota(async (_req, ctx) => {
  const { token } = await (ctx as Ctx).params

  const appointmentId = verificarTokenConfirmacao(token)
  if (!appointmentId) throw new AppError('NOT_FOUND', { message: 'Esse link de confirmação não é mais válido.' })

  const agendamento = await withNovoTenant(async (svc) => {
    // `confirmarAgendamento` já busca por id sem exigir tenant_id conhecido
    // de antemão — mas a assinatura pede tenantId. Descobre pelo próprio
    // agendamento primeiro; o token não carrega o tenant, só o id.
    const { data, error } = await svc.from('appointments').select('tenant_id, status').eq('id', appointmentId).maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!data) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })

    // Já confirmado (ou em qualquer outro estado): responde o mesmo jeito,
    // sem erro — clicar duas vezes no link não pode parecer quebrado.
    if (data.status !== 'pending') return { id: appointmentId, status: data.status }

    return confirmarAgendamento(svc, data.tenant_id, appointmentId)
  })

  return { status: agendamento.status }
})
