import { headers } from 'next/headers'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { lerCustoFixoDoTenant } from '@/server/services/custo-fixo'

import EditorCustoFixo from './editor'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Aluguel e contas' }

export default async function PaginaCustoFixo() {
  const ctx = await contextoAtual(new Request('https://interno/config/custo-fixo', { headers: await headers() }))
  const db = await criarClienteDoUsuario()
  const { custo, respondido } = await lerCustoFixoDoTenant(db, ctx.tenantId)

  return (
    <>
      <PageHeader
        titulo="Aluguel e contas"
        descricao="Três perguntas que você responde de cabeça. É o que separa o que sobrou do que sobrou de verdade."
      />
      <EditorCustoFixo inicial={custo} respondido={respondido} />
    </>
  )
}
