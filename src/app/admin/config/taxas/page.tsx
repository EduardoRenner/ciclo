import { headers } from 'next/headers'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerTaxasDoTenant } from '@/server/services/taxas-de-pagamento'

import EditorTaxas from './editor'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Taxa da maquininha' }

export default async function PaginaTaxas() {
  const ctx = await contextoAtual(new Request('https://interno/config/taxas', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const { taxas, respondida } = await lerTaxasDoTenant(db, ctx.tenantId)

  return (
    <>
      <PageHeader
        titulo="Taxa da maquininha"
        descricao="Quanto a máquina fica de cada forma de pagamento. É o que falta para o CICLO saber quanto sobrou de verdade."
      />
      <EditorTaxas inicial={taxas} respondida={respondida} />
    </>
  )
}
