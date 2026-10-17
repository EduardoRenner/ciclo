import { headers } from 'next/headers'

import { avaliarPermissao } from '@/server/auth/rbac'
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

      {/* APR-041: a tela só oferece o que o papel pode fazer — a API recusaria no toque. */}
      <ListaProfissionais profissionaisIniciais={profissionais} convitesIniciais={convites} podeGerenciar={avaliarPermissao(ctx.papel, 'professional:update') !== null} />
    </>
  )
}
