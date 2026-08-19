import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarTrilhaDoCofre } from '@/server/services/trilha-cofre'

import TrilhaCofre from './trilha'

export default async function PaginaCofre() {
  const ctx = await contextoAtual(new Request('https://interno/config/cofre', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const entradas = await listarTrilhaDoCofre(db, ctx.tenantId)

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Trilha do cofre</h1>
        <p className="mt-1 text-secundario text-txt-2">Toda vez que a ficha de saúde de uma cliente foi aberta.</p>
      </header>

      <TrilhaCofre entradasIniciais={entradas} />
    </>
  )
}
