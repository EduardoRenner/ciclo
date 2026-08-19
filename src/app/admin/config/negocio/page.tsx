import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerTenant } from '@/server/services/site'

import FormularioNegocio from './formulario'

export default async function PaginaNegocio() {
  const ctx = await contextoAtual(new Request('https://interno/admin/config/negocio', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const tenant = await lerTenant(db, ctx.tenantId)

  const urlSite = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${tenant.slug}`

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">Negócio</h1>
        <p className="mt-1 text-secundario text-txt-2">O que aparece no seu site e como as clientes te encontram.</p>
      </header>

      <FormularioNegocio tenant={tenant} urlSite={urlSite} />
    </>
  )
}
