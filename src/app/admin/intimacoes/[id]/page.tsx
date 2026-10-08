import { ArrowLeft } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { fmtDiaMes } from '@/core/advocacia/datas'
import { mascaraCnj } from '@/core/advocacia/intimacoes'
import { podeUsarModulo } from '@/core/billing/planos'
import { ehRequisicaoDoAppNativo } from '@/core/plataforma/nativo'
import { lerIntimacaoParaTriar } from '@/server/advocacia/intimacoes'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

import Triagem from './triagem'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Triagem da intimação' }

/**
 * docs/101 T4.5 e anexo 04 §4.7: triar uma intimação. O sistema SUGERE e explica (memória de cálculo);
 * quem confirma a data é a pessoa. Abrir o texto grava trilha (`legal_abrir_intimacao`).
 *
 * Intimação inexistente e intimação de caso sigiloso fora do alcance dão o mesmo 404.
 */
export default async function PaginaTriagem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request(`https://interno/intimacoes/${id}`, { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const db = await criarClienteDoUsuario()
  const plano = await contextoDePlano(db, ctx.tenantId)
  const veredito = podeUsarModulo(plano, 'legal_deadlines')
  if (veredito.estado === 'bloqueado_pelo_plano' && veredito.precisaDo !== 'gratis') {
    return (
      <BloqueioPlano
        nativo={ehRequisicaoDoAppNativo(hdrs.get('user-agent'))}
        precisaDo={veredito.precisaDo}
        acao="triar intimações e controlar prazos"
        alternativa={<Link href="/admin/casos">Ver os casos</Link>}
      />
    )
  }

  const intimacao = await lerIntimacaoParaTriar(db, ctx.tenantId, id)
  if (!intimacao) notFound()

  const casos = await db
    .from('legal_cases')
    .select('id, title, cnj_number, clients!legal_cases_client_id_tenant_id_fkey(name)')
    .eq('tenant_id', ctx.tenantId)
    .not('status', 'in', '(concluido,arquivado)')
    .order('title')
    .limit(500)
  type Caso = { id: string; title: string; cnj_number: string | null; clients: { name: string } | null }
  const lista = ((casos.data ?? []) as unknown as Caso[]).map((c) => ({ id: c.id, rotulo: `${c.title} · ${c.clients?.name ?? ''}`, cnj: c.cnj_number }))
  // o número do processo é a chave natural: se um caso tem o mesmo, ele vem escolhido
  const casoInicial = intimacao.casoId ?? lista.find((c) => c.cnj === intimacao.numero)?.id ?? null

  return (
    <>
      <Link href="/admin/hoje" className="toque-48 mb-2 inline-flex items-center gap-1 pt-4 text-secundario text-txt-2">
        <ArrowLeft aria-hidden className="size-4" />
        Hoje
      </Link>
      <header className="flex flex-col gap-1 pb-4">
        <h1 className="text-titulo font-bold text-txt">{[intimacao.tipo ?? 'Intimação', intimacao.tribunal].join(' · ')}</h1>
        <p className="text-secundario text-txt-2">
          Disponibilizada em {fmtDiaMes(intimacao.disponibilizacao)}
          {intimacao.orgao ? ` · ${intimacao.orgao}` : ''}
        </p>
        <p className="font-mono text-secundario text-txt-2">{mascaraCnj(intimacao.numero)}</p>
      </header>
      <Triagem
        intimacao={{
          id: intimacao.id,
          texto: intimacao.texto,
          status: intimacao.status,
          sugestao: intimacao.sugestao,
          semSugestao: intimacao.semSugestao,
        }}
        casos={lista.map(({ id: casoId, rotulo }) => ({ id: casoId, rotulo }))}
        casoInicial={casoInicial}
      />
    </>
  )
}
