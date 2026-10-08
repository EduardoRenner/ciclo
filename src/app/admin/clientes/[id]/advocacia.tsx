import { Briefcase, FileText, Lock, MessageCircle, Network, Plus, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import FilaDePendencias from '@/app/admin/pendencias/fila'
import DocumentosDoCaso from '@/components/advocacia/documentos'
import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import SectionHeader from '@/components/ui/section-header'
import { linkDoWhatsApp, montarFila } from '@/core/advocacia/fila-de-pendencias'
import { ROTULO_DO_ESTADO_DO_CASO, seloDoEstado } from '@/core/advocacia/resumo-do-caso'
import { podeUsarModulo } from '@/core/billing/planos'
import { listarCasos } from '@/server/advocacia/consulta-casos'
import { listarDocumentos } from '@/server/advocacia/documentos'
import { lerFilaDePendencias } from '@/server/advocacia/pendencias'
import { contextoDePlano } from '@/server/services/planos'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

const VINCULO: Record<string, string> = {
  titular: 'Titular',
  conjuge: 'Cônjuge',
  filho_filha: 'Filho ou filha',
  pai_mae: 'Pai ou mãe',
  irmao_irma: 'Irmão ou irmã',
  neto_neta: 'Neto ou neta',
  socio_socia: 'Sócio ou sócia',
  outro: 'Outro vínculo',
}

type Props = {
  db: SupabaseClient<Database>
  tenantId: string
  escritorio: string
  clienteId: string
  hoje: string
}

/**
 * docs/101 T2.5 e anexo 04 §4.3: o Cliente 360 do pacote Advocacia. Topo com o "Próximo passo" de
 * TODOS os casos do cliente (o mais urgente ganha) e as saídas (WhatsApp, + Caso, Estrutura); depois
 * pendências (a mesma fila do botão central, recortada no cliente), casos e pessoas da família.
 *
 * A linha do tempo (anexo 04 §4.3) fica para quando a trilha tiver leitura por cliente: mostrar o
 * `audit_log` cru aqui seria mostrar ação sem contexto.
 */
export default async function Cliente360({ db, tenantId, escritorio, clienteId, hoje }: Props) {
  const [cliente, pessoas, empresas, casos, itens, documentos, plano] = await Promise.all([
    db.from('clients').select('name, phone_e164').eq('tenant_id', tenantId).eq('id', clienteId).is('deleted_at', null).maybeSingle(),
    db.from('legal_persons').select('id, full_name, relationship').eq('tenant_id', tenantId).eq('client_id', clienteId).is('archived_at', null).order('created_at'),
    db.from('legal_entities').select('id').eq('tenant_id', tenantId).eq('client_id', clienteId).limit(1),
    listarCasos(db, tenantId, { encerrados: null, hoje, clienteId }),
    lerFilaDePendencias(db, tenantId, { clienteId }),
    listarDocumentos(db, tenantId, { clienteId }),
    contextoDePlano(db, tenantId),
  ])
  if (cliente.error || pessoas.error || empresas.error) throw cliente.error ?? pessoas.error ?? empresas.error
  if (!cliente.data) notFound()

  const ativos = casos.casos.filter((c) => c.estado !== 'concluido' && c.estado !== 'arquivado')
  const encerrados = casos.casos.filter((c) => c.estado === 'concluido' || c.estado === 'arquivado')
  // listarCasos já ordena pelo que aperta primeiro: o próximo passo do cliente é o do primeiro caso que tem um
  const proximo = ativos.find((c) => c.proximo)?.proximo ?? null
  const grupos = montarFila(itens, hoje, escritorio)
  const temEstrutura = (empresas.data ?? []).length > 0

  return (
    <>
      {/* o cabeçalho do painel já tem "Clientes" para voltar nas rotas filhas: um segundo seria ruído */}
      <header className="flex flex-col gap-3 pb-5 pt-4">
        <h1 className="text-titulo font-bold text-txt">{cliente.data.name}</h1>
        {proximo ? (
          <Card className={`p-3 ${proximo.atrasado ? 'border-bad/40' : ''}`}>
            <p className="text-label font-semibold uppercase tracking-wide text-txt-3">Próximo passo</p>
            <p className={`text-corpo font-semibold ${proximo.atrasado ? 'text-bad' : 'text-txt'}`}>{proximo.texto}</p>
            <p className="text-secundario text-txt-2">
              {proximo.de === 'cliente' ? 'Depende do cliente' : 'Com o escritório'}
              {proximo.atrasado ? ' · atrasado' : ''}
            </p>
          </Card>
        ) : (
          <p className="text-secundario text-txt-2">Nada pendente com este cliente.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {cliente.data.phone_e164 ? (
            <a
              href={linkDoWhatsApp(cliente.data.phone_e164, '')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 text-secundario font-semibold"
            >
              <MessageCircle aria-hidden className="size-4" />
              WhatsApp
            </a>
          ) : null}
          <Link
            href={`/admin/casos/novo?cliente=${clienteId}`}
            className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-acc px-4 text-secundario font-semibold text-on-acc"
          >
            <Plus aria-hidden className="size-4" />
            Caso
          </Link>
          {temEstrutura ? (
            <Link
              href={`/admin/clientes/${clienteId}/estrutura`}
              className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 text-secundario font-semibold"
            >
              <Network aria-hidden className="size-4" />
              Estrutura da família
            </Link>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="sec-pend" className="mb-6">
        <SectionHeader>
          <span id="sec-pend">Pendências</span>
        </SectionHeader>
        {grupos.length === 0 ? <p className="text-secundario text-txt-2">Nenhuma pendência aberta.</p> : <FilaDePendencias grupos={grupos} />}
      </section>

      <section aria-labelledby="sec-casos" className="mb-6">
        <SectionHeader icone={<Briefcase className="size-4" />}>
          <span id="sec-casos">Casos</span>
        </SectionHeader>
        {casos.casos.length === 0 ? (
          <p className="text-secundario text-txt-2">
            Nenhum caso ainda.{' '}
            <Link href={`/admin/casos/novo?cliente=${clienteId}`} className="font-semibold text-acc-2">
              Abrir um caso
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...ativos, ...encerrados].map((c) => (
              <li key={c.id}>
                <Link href={`/admin/casos/${c.id}`} className="block rounded-[var(--radius-md)]">
                  <Card pressionavel className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-corpo font-semibold">
                        {c.sigiloso ? <Lock aria-label="Sigiloso" className="size-4 shrink-0 text-txt-2" /> : null}
                        <span className="truncate">{c.titulo}</span>
                      </p>
                      {c.proximo ? (
                        <p className={`text-secundario ${c.proximo.atrasado ? 'text-bad' : 'text-txt-2'}`}>{c.proximo.texto}</p>
                      ) : null}
                    </div>
                    <Badge estado={seloDoEstado(c.estado)} className="shrink-0 whitespace-nowrap">
                      {ROTULO_DO_ESTADO_DO_CASO[c.estado]}
                    </Badge>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sec-docs" className="mb-6">
        <SectionHeader icone={<FileText className="size-4" />}>
          <span id="sec-docs">Documentos</span>
        </SectionHeader>
        <DocumentosDoCaso documentos={documentos} clienteId={clienteId} podeEnviar={podeUsarModulo(plano, 'legal_documents').estado === 'liberado'} />
      </section>

      <section aria-labelledby="sec-pessoas" className="mb-10">
        <SectionHeader icone={<Users className="size-4" />}>
          <span id="sec-pessoas">Pessoas da família</span>
        </SectionHeader>
        {(pessoas.data ?? []).length === 0 ? (
          <p className="text-secundario text-txt-2">Nenhuma pessoa cadastrada além do cliente.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {(pessoas.data ?? []).map((p) => (
              <li key={p.id} className="rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 px-3 py-1.5 text-secundario">
                {p.full_name} <span className="text-txt-3">· {VINCULO[p.relationship] ?? 'Outro vínculo'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
