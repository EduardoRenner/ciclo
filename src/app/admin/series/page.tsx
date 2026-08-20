import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarSeries } from '@/server/services/recorrencia'

import ListaSeries from './lista'
import PageHeader from '@/components/ui/page-header'

export default async function PaginaSeries() {
  const ctx = await contextoAtual(new Request('https://interno/series', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const series = await listarSeries(db, ctx.tenantId)

  return (
    <>
      <PageHeader titulo="Séries de recorrência" descricao={`${series.length} ${series.length === 1 ? 'série' : 'séries'}`} />
      <ListaSeries iniciais={series} />
    </>
  )
}
