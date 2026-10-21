import { avisoDeCancelamentoPelaCliente } from '@/core/mensageria/aviso-de-cancelamento'
import { APP_URL } from '@/lib/app-url'
import { withNovoTenant } from '@/server/db/with-tenant'
import { agendarDepois } from '@/server/http/depois'
import { notificarProximoDaLista } from '@/server/services/lista-espera'
import { notificarEquipe } from '@/server/services/mensageria'
import { cancelarAgendamento } from '@/server/services/agendamentos'
import { verificarTokenConfirmacao } from '@/server/services/confirmacao-token'
import { AppError } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { LIMITE_ACAO, limitarRotaPublica } from '@/server/http/limite-publico'

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
export const POST = rota(async (req, ctx) => {
  const { token } = await (ctx as Ctx).params
  await limitarRotaPublica(req, 'cancelar', LIMITE_ACAO)

  const appointmentId = verificarTokenConfirmacao(token)
  if (!appointmentId) throw new AppError('NOT_FOUND', { message: 'Esse link não é mais válido.' })

  return withNovoTenant(async (svc) => {
    const { data, error } = await svc
      .from('appointments')
      .select('tenant_id, status, starts_at, service_id, professional_id, tenants ( slug, timezone ), clients ( name )')
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

    // docs/112 EXP-A03: cancelar pelo link liberava a vaga sem ninguém saber; a profissional
    // descobria com a cadeira vazia. Avisa quem vai atender e quem administra (EXP-A06), depois da
    // resposta e por melhor esforço: o push falhar não pode desfazer o cancelamento.
    const tenant = data.tenants as { slug: string; timezone: string } | null
    if (tenant) {
      const aviso = avisoDeCancelamentoPelaCliente({
        nomeDaCliente: (data.clients as { name: string } | null)?.name ?? null,
        startsAt: data.starts_at,
        timezone: tenant.timezone,
      })
      agendarDepois(() =>
        notificarEquipe(svc, data.tenant_id, aviso, { professionalId: data.professional_id }).catch((erro: unknown) => {
          console.error(JSON.stringify({ level: 'error', event: 'push_cancelamento_falhou', tenantId: data.tenant_id }), erro)
        }),
      )

      // EXP-A03 parte 2: a vaga liberada pela cliente oferece o encaixe à próxima da lista de espera,
      // como o cancelamento pelo painel (TICKET-034) já fazia. Só depois do EXP-A04: sem canal que
      // chegue, a fila não marca ninguém como avisado.
      agendarDepois(() =>
        notificarProximoDaLista(
          svc,
          data.tenant_id,
          {
            serviceId: data.service_id,
            professionalId: data.professional_id,
            startsAt: data.starts_at,
            timezone: tenant.timezone,
          },
          // `APP_URL` (fonte única, com o domínio de reserva) e não `exigirEnv`: este argumento é avaliado
          // FORA do `.catch` abaixo, e sem a variável a rota inteira respondia 500 (CI de 21/10, job de banco).
          APP_URL,
        ).catch((erro: unknown) => {
          console.error(JSON.stringify({ level: 'error', event: 'lista_espera_cancelamento_falhou', tenantId: data.tenant_id }), erro)
        }),
      )
    }

    return { status: agendamento.status, slug }
  })
})
