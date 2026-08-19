import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { buscarComanda } from '@/server/services/comanda'
import { listarServicos } from '@/server/services/servicos'

import PageHeader from '@/components/ui/page-header'

import Comanda from './comanda'

export default async function PaginaComanda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/comanda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [{ ticket, items }, servicos] = await Promise.all([buscarComanda(db, ctx.tenantId, id), listarServicos(db, ctx.tenantId)])

  return (
    <>
      <PageHeader titulo="Comanda" descricao={ticket.status === 'open' ? 'Aberta' : 'Fechada'} />

      <Comanda ticketInicial={ticket} itensIniciais={items} servicos={servicos} />
    </>
  )
}
