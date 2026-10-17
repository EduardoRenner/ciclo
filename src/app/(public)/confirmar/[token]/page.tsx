import ErroPublico from '@/components/ui/erro-publico'
import { withNovoTenant } from '@/server/db/with-tenant'
import { lerHorarioParaConfirmar } from '@/server/services/confirmacao-publica'
import { verificarTokenConfirmacao } from '@/server/services/confirmacao-token'

import ConfirmarAgendamento from './confirmar'

export const metadata = { title: "Confirmar agendamento", robots: { index: false, follow: false } }

/**
 * APR-117: o horário é lido no servidor pelo token, antes de qualquer toque. Token vencido ou forjado,
 * ou agendamento que não existe mais, abre direto no erro com uma saída — antes a pessoa só descobria
 * depois de tocar em "Vou sim".
 */
export default async function PaginaConfirmar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const appointmentId = verificarTokenConfirmacao(token)
  const horario = appointmentId ? await withNovoTenant((svc) => lerHorarioParaConfirmar(svc, appointmentId)) : null

  // No topo, não no meio da tela: o horário tem que aparecer antes de qualquer rolagem ou toque
  // (medido: centrado ficava em y=374; aceite < 200).
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-[18px] pt-12 pb-8 text-center">
      {horario ? (
        <ConfirmarAgendamento token={token} horario={horario} />
      ) : (
        <ErroPublico
          titulo="Esse link não vale mais"
          mensagem="O link de confirmação vence em 3 dias, ou esse horário foi desmarcado por quem atende. Fale com quem vai te atender para combinar de novo."
          saida={{ href: '/', rotulo: 'Ir para o início' }}
        />
      )}
    </main>
  )
}
