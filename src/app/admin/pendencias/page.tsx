import { ListChecks } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { contextoDoPainel } from '@/server/auth/tenant'

export const metadata = { title: 'Pendências' }

/**
 * docs/101 T0.3: o botão central do pacote Advocacia ("o que falta de cada cliente"), ainda sem
 * dado. `legal_checklist_items` nasce na Fase 1 e a fila com "Cobrar" em um toque na Fase 2 (T2.7).
 *
 * Tenant de outro pacote recebe 404: para um salão esta rota não existe.
 */
export default async function PaginaPendencias() {
  const ctx = await contextoDoPainel(new Request('https://interno/pendencias', { headers: await headers() }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()

  return (
    <>
      <PageHeader titulo="Pendências" descricao="O que falta de cada cliente, e há quantos dias." />
      <EmptyState
        icone={<ListChecks className="size-7" />}
        titulo="Nenhuma pendência aberta"
        descricao="As pendências de cada cliente aparecem aqui, junto do caso a que pertencem."
        acao={<Link href="/admin/casos">Ver casos</Link>}
      />
    </>
  )
}
