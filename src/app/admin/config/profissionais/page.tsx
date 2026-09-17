import { headers } from 'next/headers'

import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarConvites } from '@/server/services/convites'
import { listarProfissionais } from '@/server/services/profissionais'

import ListaProfissionais from './lista'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Time" }

export default async function PaginaProfissionais() {
  const ctx = await contextoDoPainel(new Request('https://interno/config/profissionais', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const [profissionais, convites] = await Promise.all([
    listarProfissionais(db, ctx.tenantId, true),
    listarConvites(db, ctx.tenantId),
  ])

  return (
    <>
      <PageHeader titulo="Time" descricao="Quem atende, expediente e quem você já convidou." />

      <ListaProfissionais profissionaisIniciais={profissionais} convitesIniciais={convites} />
    </>
  )
}
