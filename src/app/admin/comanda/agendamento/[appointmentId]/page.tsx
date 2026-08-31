import { ReceiptText } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { buscarTicketIdPorAgendamento } from '@/server/services/comanda'

export const metadata = { title: 'Comanda' }

/**
 * Ponte da agenda para a comanda: o botão "Ver comanda" só conhece o agendamento.
 *
 * Sem comanda do outro lado isto chamava `notFound()`, e a tela dizia "O endereço não existe ou
 * mudou de lugar". A frase é FALSA: o endereço está certo, o agendamento existe — o que não existe
 * é a comanda. Medido em 2026-08-30: 100% dos atendimentos concluídos do banco estavam nesse caso
 * (263 de 263 na Barbearia Dom Rocha, que é o tenant de demonstração), porque foram criados como
 * `done` direto, sem passar por `concluirAgendamento` — que é quem abre a comanda.
 *
 * Pelo código de hoje isso não nasce mais: `POST .../complete` é o único caminho para `done` e
 * sempre cria a comanda. Mas dado histórico não some por o código ter melhorado, e mandar o dono
 * para um "página não encontrada" o faz duvidar do endereço, não do dado. Diz a verdade e oferece
 * a saída — §4: estado vazio nunca é beco sem saída.
 *
 * O que esta página NÃO faz, de propósito: criar a comanda que falta. Abrir comanda é escrita em
 * registro de dinheiro, e uma navegação (GET) que escreve é a armadilha que faz um refresh virar
 * dois lançamentos.
 */
export default async function RedirecionarParaComanda({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params
  const ctx = await contextoAtual(new Request('https://interno/comanda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const ticketId = await buscarTicketIdPorAgendamento(db, ctx.tenantId, appointmentId)
  if (ticketId) redirect(`/admin/comanda/${ticketId}`)

  return (
    <>
      <PageHeader titulo="Comanda" />
      <Card className="p-0">
        <EmptyState
          icone={<ReceiptText aria-hidden className="size-6" />}
          titulo="Esse atendimento não tem comanda"
          descricao="A comanda é aberta na hora de concluir o atendimento. Este aqui foi concluído antes disso, então não há nada para mostrar."
          acao={<Link href="/admin/agenda">Voltar para a agenda</Link>}
        />
      </Card>
    </>
  )
}
