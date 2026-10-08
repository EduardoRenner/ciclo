import { Lock, Network, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'

import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { montarClientes, ROTULO_DA_FASE } from '@/core/advocacia/clientes-do-pacote'
import { listarCasos } from '@/server/advocacia/consulta-casos'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = { db: SupabaseClient<Database>; tenantId: string; hoje: string; filtro: 'todos' | 'ativos' }

/**
 * docs/101 T2.4 e anexo 04 §4.2: Clientes no pacote Advocacia. Fase, quem responde, o próximo passo e
 * os selos (sigilo, holding), na ordem do que aperta primeiro. Os números e o CRM do salão (aniversário,
 * recuperar, fidelidade) não fazem sentido aqui e não aparecem.
 */
export default async function ClientesDaAdvocacia({ db, tenantId, hoje, filtro }: Props) {
  const [clientes, casos, holdings] = await Promise.all([
    db.from('clients').select('id, name, phone_e164').eq('tenant_id', tenantId).is('deleted_at', null).order('name').limit(1000),
    listarCasos(db, tenantId, { encerrados: null, hoje }),
    db.from('legal_entities').select('client_id').eq('tenant_id', tenantId).in('kind', ['holding_patrimonial', 'holding_participacoes', 'holding_mista']),
  ])
  if (clientes.error || holdings.error) throw new AppError('INTERNAL', { cause: clientes.error ?? holdings.error })

  const todos = montarClientes(
    (clientes.data ?? []).map((c) => ({ id: c.id, nome: c.name, telefone: c.phone_e164 })),
    casos.casos.map((c) => ({ clienteId: c.clienteId, estado: c.estado, sigiloso: c.sigiloso, responsavel: c.responsavel, proximo: c.proximo })),
    new Set((holdings.data ?? []).map((h) => h.client_id)),
  )
  const lista = filtro === 'ativos' ? todos.filter((c) => c.fase === 'ativo') : todos
  const atrasados = todos.filter((c) => c.proximo?.atrasado).length
  const aba = (ativo: boolean) =>
    `inline-flex h-12 items-center rounded-[var(--radius-pill)] px-4 text-secundario font-semibold ${
      ativo ? 'bg-acc text-on-acc' : 'border border-line-2 bg-surface-2 text-txt-2'
    }`

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao={`${todos.length} ${todos.length === 1 ? 'cliente' : 'clientes'}${atrasados > 0 ? ` · ${atrasados} com algo atrasado` : ''}`}
        acao={
          <Link href="/admin/clientes/nova" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-acc px-5 text-corpo font-semibold text-on-acc">
            <UserPlus aria-hidden className="size-5" />
            Cliente
          </Link>
        }
      />
      <nav aria-label="Filtrar clientes" className="mb-4 flex gap-2">
        <Link href="/admin/clientes" aria-current={filtro === 'todos' ? 'page' : undefined} className={aba(filtro === 'todos')}>
          Todos
        </Link>
        <Link href="/admin/clientes?fase=ativos" aria-current={filtro === 'ativos' ? 'page' : undefined} className={aba(filtro === 'ativos')}>
          Com caso aberto
        </Link>
      </nav>

      {lista.length === 0 ? (
        <EmptyState
          icone={<Users className="size-7" />}
          titulo="Nenhum cliente ainda"
          descricao="Cadastre o cliente ou traga a planilha que o escritório já usa."
          acao={<Link href="/admin/clientes/importar">Importar planilha</Link>}
        />
      ) : (
        <ul className="flex flex-col gap-2 pb-8">
          {lista.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clientes/${c.id}`} className="block rounded-[var(--radius-md)]">
                <Card pressionavel className="flex flex-col gap-1 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-corpo font-semibold">{c.nome}</p>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {c.holding ? <Network aria-label="Tem holding" className="size-4 text-txt-2" /> : null}
                      {c.sigiloso ? <Lock aria-label="Tem caso sigiloso" className="size-4 text-txt-2" /> : null}
                      <Badge estado={c.fase === 'ativo' ? 'ciclo' : c.fase === 'encerrado' ? 'ok' : 'warn'} className="whitespace-nowrap">
                        {ROTULO_DA_FASE[c.fase]}
                      </Badge>
                    </span>
                  </div>
                  {c.proximo ? (
                    <p className={`text-secundario ${c.proximo.atrasado ? 'text-bad' : 'text-txt-2'}`}>
                      {c.proximo.texto}
                      {c.proximo.atrasado ? ' · atrasado' : ''}
                    </p>
                  ) : null}
                  {c.responsavel || c.casosAtivos > 0 ? (
                    <p className="text-label text-txt-3">
                      {[c.responsavel, c.casosAtivos > 0 ? `${c.casosAtivos} ${c.casosAtivos === 1 ? 'caso aberto' : 'casos abertos'}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
