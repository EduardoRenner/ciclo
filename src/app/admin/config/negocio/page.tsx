import { headers } from 'next/headers'

import { urlDaVitrine } from '@/core/text/vitrine'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerTenant } from '@/server/services/site'

import FormularioNegocio from './formulario'
import ImagensDoSite from './imagens'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Negócio" }

export default async function PaginaNegocio() {
  const ctx = await contextoAtual(new Request('https://interno/admin/config/negocio', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const tenant = await lerTenant(db, ctx.tenantId)

  const urlSite = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${tenant.slug}`

  return (
    <>
      <PageHeader titulo="Negócio" descricao="O que aparece no seu site e como as pessoas te encontram." />

      {/*
        Antes do formulário de texto de propósito: é a mudança que a pessoa VÊ na página dela, e
        a que responde "por que meu site parece o de todo mundo?".
      */}
      <div className="mb-4">
        <ImagensDoSite logoUrl={urlDaVitrine(tenant.site.logoKey)} coverUrl={urlDaVitrine(tenant.site.coverKey)} />
      </div>

      <FormularioNegocio tenant={tenant} urlSite={urlSite} />
    </>
  )
}
