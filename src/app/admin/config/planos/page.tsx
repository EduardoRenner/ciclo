import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerConfigFidelidade, listarPlanos } from '@/server/services/fidelidade'

import EditorFidelidade from './fidelidade-config'
import EditorPlanos from './editor'
import PageHeader from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export const metadata = { title: "Fidelidade e assinatura" }

export default async function PaginaPlanos() {
  const ctx = await contextoAtual(new Request('https://interno/config/planos', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const [planos, negocio] = await Promise.all([
    listarPlanos(db, ctx.tenantId),
    db.from('tenants').select('settings').eq('id', ctx.tenantId).single(),
  ])

  return (
    <>
      <PageHeader titulo="Fidelidade e assinatura" descricao="Como o cliente ganha pontos e os planos mensais que pode assinar." />

      <EditorFidelidade inicial={lerConfigFidelidade(negocio.data?.settings)} />
      <div className="mt-7">
        <p className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Planos mensais</p>
        <EditorPlanos iniciais={planos} />
      </div>
    </>
  )
}
