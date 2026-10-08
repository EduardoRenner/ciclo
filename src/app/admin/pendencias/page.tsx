import { ListChecks } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { hojeNoFuso } from '@/core/advocacia/datas'
import { montarFila } from '@/core/advocacia/fila-de-pendencias'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { lerFilaDePendencias } from '@/server/advocacia/pendencias'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

import FilaDePendencias from './fila'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Pendências' }

/**
 * docs/101 T2.7: o botão central do pacote Advocacia, "o que falta de cada cliente, e há quantos
 * dias". A fila sai de `core/advocacia/fila-de-pendencias.ts`; esta página só lê e entrega.
 *
 * Tenant de outro pacote recebe 404: para um salão esta rota não existe.
 */
export default async function PaginaPendencias() {
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/pendencias', { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()

  const db = await criarClienteDoUsuario()
  // O plano é consultado ANTES do formulário (guarda `toda-rota-travada-tem-tela-que-avisa`): descobrir no
  // envio que o recurso é pago joga fora o trabalho que a pessoa acabou de fazer.
  const plano = await contextoDePlano(db, ctx.tenantId)
  const veredito = podeUsarModulo(plano, 'legal_checklists')
  if (veredito.estado === 'bloqueado_pelo_plano' && veredito.precisaDo !== 'gratis') {
    return (
      <BloqueioPlano
        nativo={ehRequisicaoDoAppNativo(hdrs.get('user-agent'))}
        precisaDo={veredito.precisaDo}
        acao="cobrar o que falta de cada cliente"
        alternativa={<Link href="/admin/clientes">Ver os clientes</Link>}
      />
    )
  }

  const itens = await lerFilaDePendencias(db, ctx.tenantId)
  const grupos = montarFila(itens, hojeNoFuso(ctx.tenant.timezone, new Date()), ctx.tenant.name)
  const atrasados = grupos.reduce((s, g) => s + g.atrasados, 0)
  const total = grupos.reduce((s, g) => s + g.itens.length, 0)

  return (
    <>
      <PageHeader
        titulo="Pendências"
        descricao={
          total === 0
            ? 'O que falta de cada cliente, e há quantos dias.'
            : `${total} ${total === 1 ? 'aberta' : 'abertas'} de ${grupos.length} ${grupos.length === 1 ? 'cliente' : 'clientes'}${
                atrasados > 0 ? ` · ${atrasados} ${atrasados === 1 ? 'atrasada' : 'atrasadas'}` : ''
              }`
        }
      />
      {grupos.length === 0 ? (
        <EmptyState
          icone={<ListChecks className="size-7" />}
          titulo="Nenhuma pendência aberta"
          descricao="Ao abrir um caso, as pendências do modelo aparecem aqui, agrupadas por cliente."
          acao={<Link href="/admin/casos">Ver casos</Link>}
        />
      ) : (
        <FilaDePendencias grupos={grupos} />
      )}
    </>
  )
}
