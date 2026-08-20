'use client'

import { Copy, FileText } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import Badge from '@/components/ui/badge'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import { dinheiro } from '@/lib/formato'

import type { OrcamentoDaLista } from '@/server/services/orcamentos'

type Estado = 'ok' | 'warn' | 'risk' | 'bad' | 'info' | 'ciclo'

const SELO: Record<string, { estado: Estado; texto: string }> = {
  sent: { estado: 'warn', texto: 'Aguardando resposta' },
  approved: { estado: 'ok', texto: 'Aprovado' },
  rejected: { estado: 'bad', texto: 'Recusado' },
  expired: { estado: 'risk', texto: 'Vencido' },
  converted: { estado: 'ciclo', texto: 'Virou agendamento' },
  draft: { estado: 'info', texto: 'Rascunho' },
}
const SELO_PADRAO: { estado: Estado; texto: string } = { estado: 'info', texto: 'Aguardando resposta' }

function linkPublico(token: string): string {
  return `${window.location.origin}/orcamento/${token}`
}

function LinhaOrcamento({ orcamento }: { orcamento: OrcamentoDaLista }) {
  const [copiado, setCopiado] = useState(false)
  const selo = SELO[orcamento.status] ?? SELO_PADRAO

  function copiarLink(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(linkPublico(orcamento.token)).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  // Link e botão de copiar são irmãos, não aninhados — um <button> dentro de um <a>
  // é HTML inválido (interativo dentro de interativo) e o clique fica instável entre
  // navegadores. O Card em volta não é clicável sozinho por isso.
  return (
    <Card className="flex items-center gap-3">
      <Link
        href={`/orcamento/${orcamento.token}`}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 rounded-[var(--radius-sm)] transition duration-[var(--dur-1)] active:scale-[.99] active:opacity-80"
      >
        <p className="truncate text-corpo font-semibold">{orcamento.clientName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge estado={selo.estado}>{selo.texto}</Badge>
          <span className="tabular text-secundario text-txt-3">
            {new Date(orcamento.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <p className="tabular text-corpo font-semibold text-acc-2">{dinheiro.format(orcamento.totalCents / 100)}</p>
        <button
          type="button"
          onClick={copiarLink}
          aria-label="Copiar link do orçamento"
          title={copiado ? 'Copiado!' : 'Copiar link'}
          className="toque-48 grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-txt-3 transition hover:bg-surface-2 hover:text-txt-2 active:scale-[.94]"
        >
          <Copy aria-hidden className="size-4" />
        </button>
      </div>
    </Card>
  )
}

export default function ListaOrcamentos({ orcamentos }: { orcamentos: OrcamentoDaLista[] }) {
  if (orcamentos.length === 0) {
    return (
      <EmptyState
        icone={<FileText aria-hidden className="size-6" />}
        titulo="Nenhum orçamento ainda"
        descricao="Monte um orçamento, mande o link e acompanhe a resposta por aqui."
        acao={<Link href="/admin/orcamentos/novo">Criar orçamento</Link>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {orcamentos.map((o) => (
        <LinhaOrcamento key={o.id} orcamento={o} />
      ))}
    </div>
  )
}
