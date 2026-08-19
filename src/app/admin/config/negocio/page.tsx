import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerTenant } from '@/server/services/site'

import FormularioNegocio from './formulario'
import PageHeader from '@/components/ui/page-header'

export default async function PaginaNegocio() {
  const ctx = await contextoAtual(new Request('https://interno/admin/config/negocio', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const tenant = await lerTenant(db, ctx.tenantId)

  const urlSite = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${tenant.slug}`

  return (
    <>
      <PageHeader titulo="Negócio" descricao="O que aparece no seu site e como as clientes te encontram." />

      <FormularioNegocio tenant={tenant} urlSite={urlSite} />
    </>
  )
}
