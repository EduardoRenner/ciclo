import { ArrowLeft, Network } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { fmtDiaMes, hojeNoFuso } from '@/core/advocacia/datas'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { lerEstrutura } from '@/server/advocacia/estrutura'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

import CadastroDaEstrutura from './cadastro'
import EstruturaInterativa from './interativa'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Estrutura da família' }

/**
 * docs/101 T3.2/T3.3 e anexo 04 §4.5: quem controla o quê na família, numa data. Lista indentada por
 * padrão (celular e leitor de tela), grafo como alternativa, e o simulador "e se" que não grava.
 */
export default async function PaginaEstrutura({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ em?: string }> }) {
  const [{ id }, { em }] = await Promise.all([params, searchParams])
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request(`https://interno/clientes/${id}/estrutura`, { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const db = await criarClienteDoUsuario()
  const plano = await contextoDePlano(db, ctx.tenantId)
  const veredito = podeUsarModulo(plano, 'legal_structure')
  // ver a estrutura e cadastrar nela são o mesmo módulo: liberado, a tela também oferece o cadastro
  const podeEditar = veredito.estado === 'liberado'
  if (veredito.estado === 'bloqueado_pelo_plano' && veredito.precisaDo !== 'gratis') {
    return (
      <BloqueioPlano
        nativo={ehRequisicaoDoAppNativo(hdrs.get('user-agent'))}
        precisaDo={veredito.precisaDo}
        acao="ver a estrutura societária da família"
        alternativa={<Link href={`/admin/clientes/${id}`}>Voltar ao cliente</Link>}
      />
    )
  }

  const hoje = hojeNoFuso(ctx.tenant.timezone, new Date())
  const dia = em && /^\d{4}-\d{2}-\d{2}$/.test(em) && em <= hoje ? em : hoje
  const estrutura = await lerEstrutura(db, ctx.tenantId, id, dia)
  if (!estrutura) notFound()

  return (
    <>
      <Link href={`/admin/clientes/${id}`} className="toque-48 mb-2 inline-flex items-center gap-1 pt-4 text-secundario text-txt-2">
        <ArrowLeft aria-hidden className="size-4" />
        {estrutura.cliente}
      </Link>
      <PageHeader
        titulo="Estrutura da família"
        descricao={dia === hoje ? 'Como está hoje.' : `Como era em ${fmtDiaMes(dia)}/${dia.slice(0, 4)}.`}
      />

      {estrutura.datas.length > 1 ? (
        <nav aria-label="Linha do tempo societária" className="mb-4 flex flex-wrap gap-2">
          {[...estrutura.datas.filter((d) => d < hoje), hoje].map((d) => {
            const ativo = d === dia
            return (
              <Link
                key={d}
                href={d === hoje ? `/admin/clientes/${id}/estrutura` : `/admin/clientes/${id}/estrutura?em=${d}`}
                aria-current={ativo ? 'page' : undefined}
                className={`inline-flex h-12 items-center rounded-[var(--radius-pill)] px-4 text-secundario font-semibold ${
                  ativo ? 'bg-acc text-on-acc' : 'border border-line-2 bg-surface-2 text-txt-2'
                }`}
              >
                {d === hoje ? 'Hoje' : `${fmtDiaMes(d)}/${d.slice(2, 4)}`}
              </Link>
            )
          })}
        </nav>
      ) : null}

      {podeEditar && dia === hoje ? (
        <div className="mb-5">
          <CadastroDaEstrutura clienteId={id} pessoas={estrutura.pessoas} empresas={estrutura.empresas} hoje={hoje} />
        </div>
      ) : null}

      {estrutura.empresas.length === 0 ? (
        <EmptyState
          icone={<Network className="size-7" />}
          titulo="Nenhuma empresa cadastrada"
          descricao="Quando a família tiver holding ou empresa, a estrutura e a participação de cada pessoa aparecem aqui."
          acao={<Link href={`/admin/clientes/${id}`}>Voltar ao cliente</Link>}
        />
      ) : (
        <EstruturaInterativa pessoas={estrutura.pessoas} empresas={estrutura.empresas} arestas={estrutura.arestas} />
      )}
    </>
  )
}
