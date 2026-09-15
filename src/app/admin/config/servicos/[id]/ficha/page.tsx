import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarFicha, listarProdutosParaFicha } from '@/server/services/ficha-de-consumo'
import { listarProdutosAtivos } from '@/server/services/estoque'

import EditorDaFicha from './editor'
import SugestaoDeProduto from './sugestao'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Ficha de consumo' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function PaginaFichaDeConsumo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) notFound()

  const ctx = await contextoAtual(new Request('https://interno/config/servicos/ficha', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [servico, ficha, produtos, produtosDeRevenda] = await Promise.all([
    db.from('services').select('name, suggested_product_id').eq('tenant_id', ctx.tenantId).eq('id', id).maybeSingle(),
    listarFicha(db, ctx.tenantId, id),
    listarProdutosParaFicha(db, ctx.tenantId),
    listarProdutosAtivos(db, ctx.tenantId),
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

      {/*
        0091, pedido direto do Eduardo: quando a cliente marca este serviço, oferecer um produto de
        revenda relacionado (corte de cabelo → máscara de hidratação). Fica NESTA página — não numa
        tela nova — porque as duas coisas são a mesma pergunta de fundo ("o que este serviço leva
        junto?"), só que uma é consumida (ficha) e a outra é oferecida para vender (sugestão).
      */}
      <div className="mt-6">
        {/*
          `price_cents` pode ser `null` no cadastro (produto de revenda sem preço ainda) — mesma
          regra que `adicionarItemComanda` já aplica: sem preço, não é oferecível. Filtra aqui, não
          no componente, porque é uma decisão de dado, não de apresentação.
        */}
        <SugestaoDeProduto
          serviceId={id}
          produtoSugeridoId={servico.data.suggested_product_id}
          produtos={produtosDeRevenda.filter((p): p is typeof p & { price_cents: number } => p.price_cents != null)}
        />
      </div>
    </>
  )
}
