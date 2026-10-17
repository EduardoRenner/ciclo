import ErroPublico from '@/components/ui/erro-publico'
import { withNovoTenant } from '@/server/db/with-tenant'
import { dadosParaAvaliar, verificarTokenAvaliacao } from '@/server/services/avaliacoes'

import Avaliar from './avaliar'

export const dynamic = 'force-dynamic'
export const metadata = { title: "Avaliar atendimento", robots: { index: false, follow: false } }

/**
 * APR-119 (docs/98 F-08, A-10): a avaliação é lida no servidor pelo token, e o HTML já chega com o
 * negócio e o serviço. Token vencido ou atendimento apagado abre direto no erro, com uma saída.
 */
export default async function PaginaAvaliar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const appointmentId = verificarTokenAvaliacao(token)
  const dados = appointmentId ? await withNovoTenant((svc) => dadosParaAvaliar(svc, appointmentId)) : null

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center px-[18px] pt-12 pb-8 text-center">
      {dados ? (
        <Avaliar token={token} inicial={dados} />
      ) : (
        <ErroPublico
          titulo="Esse link não vale mais"
          mensagem="O link de avaliação tem prazo, ou esse atendimento não existe mais. Se quiser deixar sua opinião, fale com quem te atendeu."
          saida={{ href: '/', rotulo: 'Ir para o início' }}
        />
      )}
    </main>
  )
}
