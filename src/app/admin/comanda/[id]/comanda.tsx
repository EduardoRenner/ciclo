'use client'

import { Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'

import type { Database } from '@/server/db/types.gen'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

type Ticket = Database['public']['Tables']['tickets']['Row']
type TicketItem = Database['public']['Tables']['ticket_items']['Row']
type Servico = { id: string; name: string; price_cents: number }

async function chamar<T>(url: string, opcoes: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    ...opcoes,
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID(), ...opcoes.headers },
  })
  const json = (await r.json()) as { data?: T; error?: { message: string } }
  if (!r.ok) throw new Error(json.error?.message ?? 'Não consegui completar a ação.')
  return json.data as T
}

export default function Comanda({
  ticketInicial,
  itensIniciais,
  servicos,
}: {
  ticketInicial: Ticket
  itensIniciais: TicketItem[]
  servicos: Servico[]
}) {
  const [ticket, setTicket] = useState(ticketInicial)
  const [itens, setItens] = useState(itensIniciais)
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  const [desconto, setDesconto] = useState(String(ticket.discount_cents / 100))
  const [gorjeta, setGorjeta] = useState(String(ticket.tip_cents / 100))
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const mostrarToast = useToast()

  const aberta = ticket.status === 'open'

  function adicionarItem() {
    if (!ticket.professional_id) {
      setErro('Essa comanda não tem profissional vinculado.')
      return
    }
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const item = await chamar<TicketItem>(`/api/v1/tickets/${ticket.id}/items`, {
          method: 'POST',
          body: JSON.stringify({ serviceId: servicoId, professionalId: ticket.professional_id, qty: Number(qty) }),
        })
        setItens((atual) => [...atual, item])
        await recarregarTicket()
        setQty('1')
      } catch (e) {
        setErro((e as Error).message)
      }
    })
  }

  function removerItem(itemId: string) {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        await chamar(`/api/v1/tickets/${ticket.id}/items/${itemId}`, { method: 'DELETE' })
        setItens((atual) => atual.filter((i) => i.id !== itemId))
        await recarregarTicket()
      } catch (e) {
        setErro((e as Error).message)
      }
    })
  }

  async function recarregarTicket() {
    const dados = await chamar<{ ticket: Ticket; items: TicketItem[] }>(`/api/v1/tickets/${ticket.id}`)
    setTicket(dados.ticket)
    setItens(dados.items)
  }

  function salvarDescontoGorjeta() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const dados = await chamar<{ ticket: Ticket; items: TicketItem[] }>(`/api/v1/tickets/${ticket.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ discountCents: Math.round(Number(desconto) * 100), tipCents: Math.round(Number(gorjeta) * 100) }),
        })
        setTicket(dados.ticket)
      } catch (e) {
        setErro((e as Error).message)
      }
    })
  }

  function fechar() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const fechado = await chamar<Ticket>(`/api/v1/tickets/${ticket.id}/close`, { method: 'POST' })
        setTicket(fechado)
        mostrarToast({ tom: 'ok', titulo: 'Comanda fechada' })
      } catch (e) {
        setErro((e as Error).message)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <Card className="flex flex-col gap-2 p-0">
        {itens.length === 0 ? (
          <p className="p-4 text-secundario text-txt-2">Nenhum item ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2">
            {itens.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-corpo font-semibold">{item.description}</p>
                  <p className="text-secundario text-txt-2">
                    {item.qty}× {dinheiro.format(item.unit_price_cents / 100)}
                    {item.discount_cents > 0 ? ` − ${dinheiro.format(item.discount_cents / 100)}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular text-corpo font-bold">{dinheiro.format(item.total_cents / 100)}</span>
                  {aberta ? (
                    <button
                      type="button"
                      aria-label={`Remover ${item.description}`}
                      disabled={pendente}
                      onClick={() => removerItem(item.id)}
                      className="text-txt-2 disabled:opacity-50"
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {aberta && servicos.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <p className="text-corpo font-semibold">Adicionar item</p>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Serviço</span>
            <select
              value={servicoId}
              onChange={(e) => setServicoId(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            >
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {dinheiro.format(s.price_cents / 100)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Quantidade</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.001"
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          <Button largura="cheia" carregando={pendente} onClick={adicionarItem}>
            Adicionar
          </Button>
        </Card>
      ) : null}

      {aberta ? (
        <Card className="flex flex-col gap-3">
          <p className="text-corpo font-semibold">Desconto e gorjeta</p>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Desconto (R$)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              onBlur={salvarDescontoGorjeta}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label font-semibold text-txt-2">Gorjeta (R$)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={gorjeta}
              onChange={(e) => setGorjeta(e.target.value)}
              onBlur={salvarDescontoGorjeta}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo tabular text-txt"
            />
          </label>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-1">
        <div className="flex justify-between text-secundario text-txt-2">
          <span>Subtotal</span>
          <span className="tabular">{dinheiro.format(ticket.subtotal_cents / 100)}</span>
        </div>
        <div className="flex justify-between text-titulo font-bold">
          <span>Total</span>
          <span className="tabular">{dinheiro.format(ticket.total_cents / 100)}</span>
        </div>
      </Card>

      {aberta ? (
        <Button largura="cheia" carregando={pendente} disabled={itens.length === 0} onClick={fechar}>
          Fechar comanda
        </Button>
      ) : (
        <p className="text-center text-secundario text-txt-2">Comanda fechada — nada mais pode mudar aqui.</p>
      )}
    </div>
  )
}
