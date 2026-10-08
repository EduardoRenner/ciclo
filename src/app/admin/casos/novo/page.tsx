import { ArrowLeft } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import PageHeader from '@/components/ui/page-header'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

import FormularioNovoCaso from './formulario'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Novo caso' }

/**
 * docs/101 T2.1: abrir um caso. O plano é consultado antes do formulário (guarda
 * `toda-rota-travada-tem-tela-que-avisa`); o cliente pode vir pré-escolhido (`?cliente=`), que é o
 * caminho do "+ Caso" na ficha do cliente.
 */
export default async function PaginaNovoCaso({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request('https://interno/casos/novo', { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()

  const db = await criarClienteDoUsuario()
  const plano = await contextoDePlano(db, ctx.tenantId)
  const veredito = podeUsarModulo(plano, 'legal_cases')
  if (veredito.estado === 'bloqueado_pelo_plano' && veredito.precisaDo !== 'gratis') {
    return (
      <BloqueioPlano
        nativo={ehRequisicaoDoAppNativo(hdrs.get('user-agent'))}
        precisaDo={veredito.precisaDo}
        acao="organizar os casos do escritório"
        alternativa={<Link href="/admin/clientes">Ver os clientes</Link>}
      />
    )
  }

  const [{ cliente }, clientes, equipe] = await Promise.all([
    searchParams,
    db.from('clients').select('id, name').eq('tenant_id', ctx.tenantId).is('deleted_at', null).order('name').limit(1000),
    db.from('professionals').select('id, user_id, display_name, legal_role').eq('tenant_id', ctx.tenantId).eq('active', true).order('display_name'),
  ])

  return (
    <>
      <Link href="/admin/casos" className="toque-48 mb-2 inline-flex items-center gap-1 pt-4 text-secundario text-txt-2">
        <ArrowLeft aria-hidden className="size-4" />
        Casos
      </Link>
      <PageHeader titulo="Novo caso" descricao="O caso já nasce com as pendências do modelo do tipo escolhido." />
      <FormularioNovoCaso
        clientes={(clientes.data ?? []).map((c) => ({ id: c.id, nome: c.name }))}
        equipe={(equipe.data ?? []).filter((p) => p.legal_role === 'advogado').map((p) => ({ id: p.id, nome: p.display_name }))}
        clienteInicial={cliente && (clientes.data ?? []).some((c) => c.id === cliente) ? cliente : null}
        // quem abre o caso e é da advocacia já vem como responsável; o estágio escolhe quem assina
        responsavelInicial={(equipe.data ?? []).find((p) => p.user_id === ctx.sessao.userId && p.legal_role === 'advogado')?.id ?? null}
      />
    </>
  )
}
