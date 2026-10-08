import { ListChecks } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

export const metadata = { title: 'Pendências' }

/**
 * docs/101 T0.3: o botão central do pacote Advocacia ("o que falta de cada cliente"), ainda sem
 * dado. `legal_checklist_items` nasce na Fase 1 e a fila com "Cobrar" em um toque na Fase 2 (T2.7).
 *
 * Tenant de outro pacote recebe 404: para um salão esta rota não existe.
 */
export default async function PaginaPendencias() {
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/pendencias', { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()

  // O plano é consultado ANTES do formulário (guarda `toda-rota-travada-tem-tela-que-avisa`): descobrir no
  // envio que o recurso é pago joga fora o trabalho que a pessoa acabou de fazer.
  const plano = await contextoDePlano(await criarClienteDoUsuario(), ctx.tenantId)
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
