'use client'

import { Send, Sparkles } from 'lucide-react'
import { useState } from 'react'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Skeleton from '@/components/ui/skeleton'
import StatTile from '@/components/ui/stat-tile'
import { cn } from '@/lib/utils'

import type { ItemRecuperar, ListaRecuperar } from '@/server/services/recuperar-receita'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Estado = 'due' | 'late' | 'at_risk' | 'lost'

const FILTROS: { valor: Estado | 'all'; rotulo: string }[] = [
  { valor: 'all', rotulo: 'Todas' },
  { valor: 'due', rotulo: 'Na hora de voltar' },
  { valor: 'late', rotulo: 'Atrasadas' },
  { valor: 'at_risk', rotulo: 'Em risco' },
  { valor: 'lost', rotulo: 'Perdidas' },
]

const RUBRICA_ESTADO: Record<Estado, string> = {
  due: 'Na hora de voltar',
  late: 'Atrasada',
  at_risk: 'Em risco',
  lost: 'Perdida',
}

function chave(item: Pick<ItemRecuperar, 'clientId' | 'serviceId'>): string {
  return `${item.clientId}:${item.serviceId}`
}

export default function RecuperarReceita({ inicial }: { inicial: ListaRecuperar }) {
  const [filtro, setFiltro] = useState<Estado | 'all'>('all')
  const [lista, setLista] = useState(inicial)
  const [carregando, setCarregando] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function trocarFiltro(valor: Estado | 'all') {
    setFiltro(valor)
    setSelecionados(new Set())
    setCarregando(true)
    try {
      const qs = valor === 'all' ? '' : `?state=${valor}`
      const r = await fetch(`/api/v1/cycle/recover${qs}`)
      const json = (await r.json()) as { data?: ListaRecuperar }
      if (json.data) setLista(json.data)
    } finally {
      setCarregando(false)
    }
  }

  function alternar(item: ItemRecuperar) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      const k = chave(item)
      if (proximo.has(k)) proximo.delete(k)
      else proximo.add(k)
      return proximo
    })
  }

  async function enviar(itens: ItemRecuperar[]) {
    if (itens.length === 0) return
    setEnviando(true)
    setAviso(null)
    try {
      const r = await fetch('/api/v1/cycle/recover/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          items: itens.map((i) => ({ clientId: i.clientId, serviceId: i.serviceId })),
          mode: 'template',
        }),
      })
      const json = (await r.json()) as { data?: { queued: number; skipped: { clientId: string; reason: string }[] } }
      const queued = json.data?.queued ?? 0
      const puladas = json.data?.skipped.length ?? 0
      setAviso(
        puladas === 0
          ? `Mensagem enviada para ${queued} ${queued === 1 ? 'cliente' : 'clientes'}.`
          : `${queued} enviada(s), ${puladas} não puderam ser avisadas agora (opt-out ou limite de mensagens).`,
      )
      setSelecionados(new Set())
      await trocarFiltro(filtro)
    } finally {
      setEnviando(false)
    }
  }

  const itensSelecionados = lista.items.filter((i) => selecionados.has(chave(i)))

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatTile rotulo="Valor parado" valor={dinheiro.format(lista.totalValueCents / 100)} />
        <StatTile rotulo="Clientes" valor={String(lista.count)} />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => trocarFiltro(f.valor)}
            className={cn(
              'shrink-0 rounded-[var(--radius-pill)] border px-3.5 py-2 text-secundario font-semibold transition',
              filtro === f.valor ? 'border-acc-2 bg-acc-soft text-acc-2' : 'border-line-2 bg-surface-2 text-txt-2',
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {aviso ? <p className="mb-4 rounded-[var(--radius-sm)] bg-acc-soft p-3 text-secundario text-txt">{aviso}</p> : null}

      {itensSelecionados.length > 0 ? (
        <button
          type="button"
          disabled={enviando}
          onClick={() => enviar(itensSelecionados)}
          className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] text-corpo font-bold text-[#0a0a0f] disabled:opacity-60"
        >
          <Send aria-hidden className="size-4" />
          {enviando ? 'Enviando…' : `Avisar ${itensSelecionados.length} selecionada(s)`}
        </button>
      ) : null}

      {carregando ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </Card>
          ))}
        </div>
      ) : lista.items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icone={<Sparkles aria-hidden className="size-6" />}
            titulo="Ninguém para recuperar agora"
            descricao="Quando alguma cliente atrasar para voltar, ela aparece aqui."
            acao={<span className="text-secundario text-txt-3">Volte mais tarde</span>}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.items.map((item) => {
            const k = chave(item)
            const marcada = selecionados.has(k)
            return (
              <li key={k}>
                <Card className={cn('flex items-center gap-3', marcada && 'border-acc-2')}>
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${item.name}`}
                    checked={marcada}
                    onChange={() => alternar(item)}
                    className="size-5 shrink-0 accent-[var(--acc-2)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-corpo font-semibold">{item.name}</p>
                    <p className="truncate text-secundario text-txt-2">
                      {item.serviceName} · {RUBRICA_ESTADO[item.state as Estado]} · {item.lateDays > 0 ? `${item.lateDays}d atrasada` : 'na janela'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-corpo font-bold text-acc-2">{dinheiro.format(item.valueCents / 100)}</p>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => enviar([item])}
                      className="mt-1 text-label font-semibold text-txt-2 underline disabled:opacity-60"
                    >
                      Avisar
                    </button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
