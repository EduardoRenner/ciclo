import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { listarProfissionais } from '@/server/services/profissionais'
import { criarClienteDoUsuario } from '@/server/db/server-client'

import FormularioOrcamento from './formulario'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Novo orçamento" }

export default async function PaginaNovoOrcamento() {
  const ctx = await contextoAtual(new Request('https://interno/orcamentos/novo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const profissionais = await listarProfissionais(db, ctx.tenantId)

  return (
    <>
      <PageHeader titulo="Novo orçamento" />
      <FormularioOrcamento profissionais={profissionais.map((p) => ({ id: p.id, display_name: p.display_name }))} />
    </>
  )
}
