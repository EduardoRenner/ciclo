import { ArrowLeft, CalendarClock, FileText, Lock, Users } from 'lucide-react'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import FilaDePendencias from '@/app/admin/pendencias/fila'
import DocumentosDoCaso from '@/components/advocacia/documentos'
import MudarCaso from '@/components/advocacia/mudar-caso'
import PrazosDoCaso from '@/components/advocacia/prazos'
import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import { hojeNoFuso } from '@/core/advocacia/datas'
import { montarFila } from '@/core/advocacia/fila-de-pendencias'
import { ROTULO_DO_ESTADO_DO_CASO, seloDoEstado } from '@/core/advocacia/resumo-do-caso'
import { podeUsarModulo } from '@/core/billing/planos'
import { lerCaso } from '@/server/advocacia/consulta-casos'
import { listarDocumentos } from '@/server/advocacia/documentos'
import { lerFilaDePendencias } from '@/server/advocacia/pendencias'
import { contextoDoPainel } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { contextoDePlano } from '@/server/services/planos'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Caso' }

const ROTULO_DO_PAPEL: Record<string, string> = { responsavel: 'Responsável', equipe: 'Equipe' }

/**
 * docs/101 T2.6 e anexo 04 §4.4: a ficha do caso. Topo com o título interno, o que o cliente LÊ, o
 * estado e o "Próximo passo"; depois prazos, pendências (a mesma fila do botão central, recortada no
 * caso) e equipe.
 *
 * Caso inexistente e caso sigiloso fora do alcance dão o MESMO 404: a diferença viraria um verificador
 * de casos sigilosos. Abrir um sigiloso grava trilha (0111), e a tela diz isso.
 */
export default async function PaginaCaso({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hdrs = await headers()
  const ctx = await contextoDoPainel(new Request(`https://interno/casos/${id}`, { headers: hdrs }))
  if (ctx.tenant.pacote !== 'advocacia') notFound()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const db = await criarClienteDoUsuario()
  const hoje = hojeNoFuso(ctx.tenant.timezone, new Date())
  const caso = await lerCaso(db, ctx.tenantId, id, hoje)
  if (!caso) notFound()

  const [itens, trilha, documentos, plano] = await Promise.all([
    lerFilaDePendencias(db, ctx.tenantId, { casoId: id }),
    caso.sigiloso ? db.rpc('legal_registrar_abertura_do_caso', { p_case: id }) : Promise.resolve(null),
    listarDocumentos(db, ctx.tenantId, { casoId: id }),
    contextoDePlano(db, ctx.tenantId),
  ])
  // o plano é consultado ANTES do formulário de envio (guarda `toda-rota-travada-tem-tela-que-avisa`)
  const podeEnviar = podeUsarModulo(plano, 'legal_documents').estado === 'liberado'
  const grupos = montarFila(itens, hoje, ctx.tenant.name)

  return (
    <>
      <Link href="/admin/casos" className="toque-48 mb-2 inline-flex items-center gap-1 pt-4 text-secundario text-txt-2">
        <ArrowLeft aria-hidden className="size-4" />
        Casos
      </Link>

      <header className="flex flex-col gap-2 pb-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-titulo font-bold text-txt">{caso.titulo}</h1>
          <Badge estado={seloDoEstado(caso.estado)} className="mt-1 shrink-0 whitespace-nowrap">
            {ROTULO_DO_ESTADO_DO_CASO[caso.estado]}
          </Badge>
        </div>
        <p className="text-secundario text-txt-2">
          <Link href={`/admin/clientes/${caso.clienteId}`} className="font-semibold text-txt underline-offset-2 hover:underline">
            {caso.clienteNome}
          </Link>
          {caso.responsavel ? ` · ${caso.responsavel}` : ''}
          {caso.comarca ? ` · ${caso.comarca}` : ''}
        </p>
        <p className="text-secundario text-txt-2">
          O cliente lê: <span className="text-txt">“{caso.paraCliente}”</span>
        </p>
        <MudarCaso casoId={id} estado={caso.estado} rowVersion={caso.rowVersion} notaAtual={caso.notaParaCliente} />
        <Link href={`/admin/clientes/${caso.clienteId}/estrutura`} className="toque-48 inline-flex w-fit items-center text-secundario font-semibold text-acc-2">
          Estrutura da família
        </Link>
      </header>

      {caso.sigiloso ? (
        <div role="note" className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-line-2 bg-surface-2 p-3 text-secundario">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            Caso sigiloso: só a equipe do caso vê.
            {trilha && !trilha.error ? <span className="block text-label text-txt-3">Esta abertura ficou registrada na trilha do caso.</span> : null}
          </p>
        </div>
      ) : null}

      {caso.proximo ? (
        <Card className={`mb-5 p-4 ${caso.proximo.atrasado ? 'border-bad/40' : ''}`}>
          <p className="text-label font-semibold uppercase tracking-wide text-txt-3">Próximo passo</p>
          <p className={`mt-1 text-corpo font-semibold ${caso.proximo.atrasado ? 'text-bad' : 'text-txt'}`}>{caso.proximo.texto}</p>
          <p className="text-secundario text-txt-2">
            {caso.proximo.de === 'cliente' ? 'Depende do cliente' : 'Com o escritório'}
            {caso.proximo.atrasado ? ' · atrasado' : ''}
          </p>
        </Card>
      ) : null}

      <section aria-labelledby="sec-prazos" className="mb-6">
        <SectionHeader icone={<CalendarClock className="size-4" />}>
          <span id="sec-prazos">Prazos</span>
        </SectionHeader>
        <PrazosDoCaso prazos={caso.prazos} hoje={hoje} clienteId={caso.clienteId} casoId={id} timezone={ctx.tenant.timezone} />
      </section>

      <section aria-labelledby="sec-pendencias" className="mb-6">
        <SectionHeader>
          <span id="sec-pendencias">Pendências do caso</span>
        </SectionHeader>
        {grupos.length === 0 ? <p className="text-secundario text-txt-2">Nenhuma pendência aberta neste caso.</p> : <FilaDePendencias grupos={grupos} />}
      </section>

      <section aria-labelledby="sec-docs" className="mb-6">
        <SectionHeader icone={<FileText className="size-4" />}>
          <span id="sec-docs">Documentos</span>
        </SectionHeader>
        <DocumentosDoCaso documentos={documentos} clienteId={caso.clienteId} casoId={id} podeEnviar={podeEnviar} />
      </section>

      <section aria-labelledby="sec-equipe" className="mb-8">
        <SectionHeader icone={<Users className="size-4" />}>
          <span id="sec-equipe">Equipe do caso</span>
        </SectionHeader>
        {caso.equipe.length === 0 ? (
          <p className="text-secundario text-txt-2">Ninguém atribuído ainda.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {caso.equipe.map((m) => (
              <li key={m.id} className="rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 py-1.5 text-secundario">
                {m.nome} <span className="text-txt-3">· {ROTULO_DO_PAPEL[m.papel] ?? 'Equipe'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
