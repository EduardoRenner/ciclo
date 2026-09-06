import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarFicha, listarProdutosParaFicha } from '@/server/services/ficha-de-consumo'

import EditorDaFicha from './editor'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Ficha de consumo' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function PaginaFichaDeConsumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const ctx = await contextoAtual(new Request('https://interno/config/servicos/ficha', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [servico, ficha, produtos] = await Promise.all([
    db.from('services').select('name').eq('tenant_id', ctx.tenantId).eq('id', id).maybeSingle(),
    listarFicha(db, ctx.tenantId, id),
    listarProdutosParaFicha(db, ctx.tenantId),
  ])
  if (!servico.data) notFound()

  return (
    <>
      <PageHeader
        titulo="Ficha de consumo"
        descricao={`O que ${servico.data.name} gasta de produto a cada atendimento.`}
        acao={
          <Link href="/admin/config/servicos" className="flex h-12 items-center text-label font-semibold text-acc-2">
            Voltar
          </Link>
        }
      />
      <EditorDaFicha serviceId={id} inicial={ficha} produtos={produtos} />
    </>
  )
}
