import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { buscarComanda } from '@/server/services/comanda'
import { listarServicos } from '@/server/services/servicos'

import Comanda from './comanda'

export default async function PaginaComanda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request('https://interno/comanda', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [{ ticket, items }, servicos] = await Promise.all([buscarComanda(db, ctx.tenantId, id), listarServicos(db, ctx.tenantId)])

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Comanda</h1>
        <p className="mt-1 text-secundario text-txt-2">{ticket.status === 'open' ? 'Aberta' : 'Fechada'}</p>
      </header>

      <Comanda ticketInicial={ticket} itensIniciais={items} servicos={servicos} />
    </>
  )
}
