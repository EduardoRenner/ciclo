import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarOrcamentos } from '@/server/services/orcamentos'

import ListaOrcamentos from './lista'
import PageHeader from '@/components/ui/page-header'

export default async function PaginaOrcamentos() {
  const ctx = await contextoAtual(new Request('https://interno/orcamentos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const orcamentos = await listarOrcamentos(db, ctx.tenantId)

  return (
    <>
      <PageHeader titulo="Orçamentos" descricao={`${orcamentos.length} ${orcamentos.length === 1 ? 'orçamento' : 'orçamentos'}`} />
      <ListaOrcamentos orcamentos={orcamentos} />
    </>
  )
}
