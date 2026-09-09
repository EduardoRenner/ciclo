import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarTrilhaDoCofre } from '@/server/services/trilha-cofre'

import TrilhaCofre from './trilha'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Trilha do cofre" }

export default async function PaginaCofre() {
  const ctx = await contextoAtual(new Request('https://interno/config/cofre', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const entradas = await listarTrilhaDoCofre(db, ctx.tenantId)

  return (
    <>
      <PageHeader titulo="Trilha do cofre" descricao="Toda vez que uma ficha de saúde foi aberta." />

      <TrilhaCofre entradasIniciais={entradas} />
    </>
  )
}
