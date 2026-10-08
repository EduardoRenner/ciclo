import { Briefcase } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { contextoDoPainel } from '@/server/auth/tenant'

export const metadata = { title: 'Casos' }

/**
 * docs/101 T0.3: a aba Casos do pacote Advocacia, ainda sem dado. As tabelas e as rotas de casos
 * nascem na Fase 1 e 2 (`legal_cases`, `POST v1/legal/cases`); até lá a tela existe para a barra do
 * pacote não levar a um 404, e diz a verdade: não há casos.
 *
 * Tenant de outro pacote recebe 404, e não a tela vazia: para um salão esta rota não existe, do
 * mesmo jeito que o módulo `legal_cases` some da tela de módulos (`fora_do_pacote`).
 */
export default async function PaginaCasos() {
  const ctx = await contextoDoPainel(new Request('https://interno/casos', { headers: await headers() }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()

  return (
    <>
      <PageHeader titulo="Casos" descricao="Os casos do escritório, com prazos, pendências e documentos." />
      <EmptyState
        icone={<Briefcase className="size-7" />}
        titulo="Nenhum caso ainda"
        descricao="Todo caso pertence a um cliente. Comece pela lista de clientes do escritório."
        acao={<Link href="/admin/clientes">Abrir clientes</Link>}
      />
    </>
  )
}
