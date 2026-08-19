'use client'

import { Send } from 'lucide-react'
import { useState } from 'react'

import ActionBar from '@/components/ui/action-bar'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import FilterRow from '@/components/ui/filter-row'
import IconeAnel from '@/components/ui/icone-anel'
import Skeleton from '@/components/ui/skeleton'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'
import { cn } from '@/lib/utils'

import type { ItemRecuperar, ListaRecuperar } from '@/server/services/recuperar-receita'

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

      <FilterRow rotulo="Filtrar por estado do ciclo" className="mb-4">
        {FILTROS.map((f) => (
          <Chip key={f.valor} ligado={filtro === f.valor} onClick={() => trocarFiltro(f.valor)}>
            {f.rotulo}
          </Chip>
        ))}
      </FilterRow>

      {aviso ? <p className="mb-4 rounded-[var(--radius-sm)] bg-acc-soft p-3 text-secundario text-txt">{aviso}</p> : null}


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
            icone={<IconeAnel aria-hidden className="size-6" />}
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
                  {/* O quadradinho tem 20px; quem precisa de 48px é o dedo.
                      O rótulo em volta é a área de toque, sem engordar o desenho. */}
                  <label className="-my-2 -ml-1.5 grid size-12 shrink-0 cursor-pointer place-items-center">
                    <span className="sr-only">{`Selecionar ${item.name}`}</span>
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => alternar(item)}
                      className="size-5 accent-[var(--acc-2)]"
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-corpo font-semibold">{item.name}</p>
                    <p className="truncate text-secundario text-txt-2">
                      {item.serviceName} · {RUBRICA_ESTADO[item.state as Estado]} · {item.lateDays > 0 ? `${item.lateDays}d atrasada` : 'na janela'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-corpo font-bold text-acc-2">{dinheiro.format(item.valueCents / 100)}</p>
                    <Button
                      variante="ghost"
                      tamanho="sm"
                      className="-mr-2 mt-0.5 px-2"
                      disabled={enviando}
                      onClick={() => enviar([item])}
                      motivoDesabilitado="Aguarde o envio em andamento terminar."
                    >
                      Avisar
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {/*
        §3.2 manda a ação primária no terço inferior da tela. O botão de enviar
        nascia acima da lista: a pessoa marcava sete clientes, rolava para
        conferir, e perdia de vista o botão que age sobre a seleção.
      */}
      <ActionBar visivel={itensSelecionados.length > 0}>
        <Button
          largura="cheia"
          carregando={enviando}
          onClick={() => enviar(itensSelecionados)}
          // `tabIndex` acompanha a visibilidade: barra escondida não pode ser
          // alcançada pelo teclado nem lida pelo leitor de tela.
          tabIndex={itensSelecionados.length > 0 ? undefined : -1}
        >
          <Send aria-hidden className="size-4" />
          {`Avisar ${itensSelecionados.length} ${itensSelecionados.length === 1 ? 'selecionada' : 'selecionadas'}`}
        </Button>
      </ActionBar>
    </div>
  )
}
