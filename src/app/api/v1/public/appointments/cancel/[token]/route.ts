import { withNovoTenant } from '@/server/db/with-tenant'
import { cancelarAgendamento } from '@/server/services/agendamentos'
import { verificarTokenConfirmacao } from '@/server/services/confirmacao-token'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'

type Ctx = { params: Promise<{ token: string }> }

/**
 * docs/09-PLATAFORMA.md G12 (P5.5): o link do WhatsApp só sabia confirmar —
 * quem precisava desmarcar tinha que ligar ou simplesmente faltar. Mesmo
 * token do TICKET-030 (HMAC, sem tabela própria, autoriza qualquer ação
 * sobre ESTE agendamento — não é escopo só de confirmar), mesmo padrão de
 * "descobrir o tenant pelo próprio agendamento" da rota de confirmação.
 * Cancelar libera a vaga na agenda automaticamente — é o que faz a falta
 * mais barata de evitar (a que o cliente avisa) parar de custar deslocamento
 * perdido pra quem vai até o cliente.
 */
export const POST = rota(async (_req, ctx) => {
  const { token } = await (ctx as Ctx).params

  const appointmentId = verificarTokenConfirmacao(token)
  if (!appointmentId) throw new AppError('NOT_FOUND', { message: 'Esse link não é mais válido.' })

  return withNovoTenant(async (svc) => {
    const { data, error } = await svc
      .from('appointments')
      .select('tenant_id, status, tenants ( slug )')
      .eq('id', appointmentId)
      .maybeSingle()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (!data) throw new AppError('NOT_FOUND', { message: 'Esse agendamento não existe mais.' })

    const slug = (data.tenants as { slug: string } | null)?.slug ?? null

    // Já cancelado (ou em estado que não cancela mais — chegou, concluiu,
    // faltou, venceu): responde o mesmo jeito, sem erro. Clicar duas vezes
    // no link não pode parecer quebrado, e um "não dá mais pra cancelar"
    // também não é erro do cliente.
    if (data.status !== 'pending' && data.status !== 'confirmed') {
      return { status: data.status, slug }
    }

    const agendamento = await cancelarAgendamento(svc, data.tenant_id, appointmentId, {
      canceledBy: 'client',
      reason: null,
    })
    return { status: agendamento.status, slug }
  })
})
