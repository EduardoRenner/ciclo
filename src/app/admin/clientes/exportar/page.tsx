import { headers } from 'next/headers'

import { avaliarPermissao } from '@/server/auth/rbac'
import { contextoDoPainel } from '@/server/auth/tenant'
import PageHeader from '@/components/ui/page-header'

import FormularioExportarClientes from './formulario'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Baixar meus clientes' }

/**
 * P3 de `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §7.4/§9. Mesma permissão que a rota
 * (`client:export`, só dono — `rbac.ts` C35): a checagem aqui não substitui a do servidor, é o
 * que evita "deixar trabalhar para recusar no envio" (`docs/20`) para quem chega direto pela URL
 * sem ser dono.
 */
export default async function PaginaExportarClientes() {
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/clientes/exportar', { headers: hdrs }))
  const podeExportar = avaliarPermissao(ctx.papel, 'client:export') !== null

  return (
    <>
      <PageHeader
        titulo="Baixar meus clientes"
        descricao="Uma planilha com todos os seus clientes, do jeito que você trouxe: para levar quando quiser."
      />
      <FormularioExportarClientes podeExportar={podeExportar} />
    </>
  )
}
