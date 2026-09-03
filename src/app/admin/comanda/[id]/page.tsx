import { headers } from 'next/headers'

import { podeUsarModulo } from '@/core/billing/planos'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { buscarComanda } from '@/server/services/comanda'
import { contextoDePlano } from '@/server/services/planos'
import { listarServicos } from '@/server/services/servicos'

import PageHeader from '@/components/ui/page-header'

import Comanda from './comanda'

export const metadata = { title: "Comanda" }

export default async function PaginaComanda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/comanda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [{ ticket, items }, servicos, plano] = await Promise.all([
    buscarComanda(db, ctx.tenantId, id),
    listarServicos(db, ctx.tenantId),
    contextoDePlano(db, ctx.tenantId),
  ])

  /*
   * `POST /api/v1/tickets/[id]/items` exige o módulo `register` (Essencial). A comanda abre para
   * todo mundo — é a tela que a agenda oferece ao concluir o atendimento — e sem a trava a pessoa
   * escolhia serviço e quantidade, tocava em Adicionar, e a rota recusava com o cliente na frente.
   *
   * Travar no botão, e não esconder a tela: ver a comanda é o que mostra o que o Essencial faz.
   */
  const podeLancarItem = podeUsarModulo(plano, 'register').estado === 'liberado'

  return (
    <>
      <PageHeader titulo="Comanda" descricao={ticket.status === 'open' ? 'Aberta' : 'Fechada'} />

      <Comanda ticketInicial={ticket} itensIniciais={items} servicos={servicos} podeLancarItem={podeLancarItem} />
    </>
  )
}
