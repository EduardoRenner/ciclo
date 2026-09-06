'use client'

import { Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import AlertBanner from '@/components/ui/alert-banner'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import type { SobraExplicada } from '@/core/comanda/sobra-explicada'
import { FORMAS_DE_PAGAMENTO, NOME_DA_FORMA, type FormaDePagamento } from '@/core/comanda/taxa-de-pagamento'

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
  podeLancarItem = true,
  sobra,
}: {
  ticketInicial: Ticket
  itensIniciais: TicketItem[]
  servicos: Servico[]
  /** `register` liberado neste degrau. Ver o comentário em `page.tsx`. */
  podeLancarItem?: boolean
  /** `null` quando a comanda está aberta ou quando o papel não alcança `report:read`. */
  sobra: SobraExplicada | null
}) {
  const [ticket, setTicket] = useState(ticketInicial)
  const [itens, setItens] = useState(itensIniciais)
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? '')
  const [qty, setQty] = useState('1')
  const [desconto, setDesconto] = useState(String(ticket.discount_cents / 100))
  const [gorjeta, setGorjeta] = useState(String(ticket.tip_cents / 100))
  // Nasce vazio de propósito: pré-selecionar "Dinheiro" faria a maioria das comandas fechar com
  // taxa zero sem ninguém escolher nada, e o "Sobrou" voltaria a ser o número inflado que a
  // `0066` existe para consertar.
  const [forma, setForma] = useState<FormaDePagamento | null>(null)
  const [pendente, iniciarTransicao] = useTransition()
  const [erro, setErro] = useState<string | null>(null)
  const mostrarToast = useToast()
  const router = useRouter()

  const aberta = ticket.status === 'open'
  // `payment_method` é o enum de oito valores do banco; `NOME_DA_FORMA` só nomeia as cinco que se
  // escolhem no fechamento. Comanda de antes da `0066` vem nula, e as três de fora (clube, pacote,
  // voucher) não têm nome aqui — nos dois casos a frase sai sem a forma, em vez de sair torta.
  const formaFechada = ticket.payment_method ? (NOME_DA_FORMA[ticket.payment_method as FormaDePagamento] ?? null) : null

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
        const fechado = await chamar<Ticket>(`/api/v1/tickets/${ticket.id}/close`, {
          method: 'POST',
          body: JSON.stringify({ paymentMethod: forma }),
        })
        setTicket(fechado)
        // O "Sobrou" é calculado no servidor (é ele que sabe a taxa do tenant e quais serviços
        // têm ficha). Sem este refresh, a comanda vira `closed` no estado local e o cartão só
        // apareceria na próxima visita à tela.
        router.refresh()
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
                  {s.name} · {dinheiro.format(s.price_cents / 100)}
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
          <Button
            largura="cheia"
            carregando={pendente}
            disabled={!podeLancarItem}
            motivoDesabilitado="Lançar item na comanda é do plano Essencial. Veja os planos em Configurações, Meu plano."
            onClick={adicionarItem}
          >
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

      {/*
        O número que o `docs/48` C1 chama de categoria nova: ao lado do preço, quanto SOBROU.
        Nenhum dos sete concorrentes pesquisados mostra isto (`docs/47` §1.6), e a razão de ele
        não estar aqui antes não era de tela — era que material e taxa valiam zero para todo
        mundo (`docs/49`).

        O que vale mais que o número é a última linha: quando falta desconto para fazer, a tela
        diz o que falta e leva até lá. Um lucro que cala sobre a maquininha não é parcial, é
        errado para cima — e é exatamente o que o setor inteiro já faz com o faturamento.
      */}
      {sobra ? (
        <Card className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-corpo font-semibold">Sobrou</span>
            <span className={`tabular text-stat font-bold ${sobra.sobraCents < 0 ? 'text-bad' : 'text-acc-2'}`}>
              {dinheiro.format(sobra.sobraCents / 100)}
            </span>
          </div>

          <dl className="flex flex-col gap-1 border-t border-line-2 pt-2 text-secundario text-txt-2">
            <div className="flex justify-between gap-3">
              <dt>Entrou</dt>
              <dd className="tabular">{dinheiro.format(sobra.receitaCents / 100)}</dd>
            </div>
            {sobra.descontos.map((linha) => (
              <div key={linha.rotulo} className="flex justify-between gap-3">
                <dt>− {linha.rotulo}</dt>
                <dd className="tabular">{dinheiro.format(linha.valorCents / 100)}</dd>
              </div>
            ))}
          </dl>

          {ticket.tip_cents > 0 ? (
            <p className="text-label text-txt-3">
              A gorjeta de {dinheiro.format(ticket.tip_cents / 100)} é de quem atendeu e não entra nesta conta.
            </p>
          ) : null}
        </Card>
      ) : null}

      {sobra?.frase ? (
        <AlertBanner
          tom="warn"
          acao={
            sobra.lacunas.includes('taxa') ? (
              <Link href="/admin/config/taxas">Informar</Link>
            ) : (
              <Link href="/admin/config/servicos">Ver serviços</Link>
            )
          }
        >
          <p className="text-secundario font-semibold">{sobra.frase}</p>
          <ul className="mt-1 text-label text-txt-2">
            {sobra.detalhes.map((detalhe) => (
              <li key={detalhe}>{detalhe}</li>
            ))}
          </ul>
        </AlertBanner>
      ) : null}

      {aberta ? (
        <>
          {/*
            A pergunta é obrigatória, e é ela que faz `tickets.fee_cents` deixar de ser uma coluna
            que ninguém escreve (`docs/49`). Botões e não `select`: são cinco opções, cabem em
            390 px, e um toque resolve — num `select` seriam três (abrir, rolar, escolher) na tela
            mais usada do dia.
          */}
          <Card className="flex flex-col gap-3">
            <p className="text-corpo font-semibold">Como a cliente pagou?</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS_DE_PAGAMENTO.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={forma === f}
                  onClick={() => setForma(f)}
                  className={`min-h-12 rounded-[var(--radius-sm)] border px-3 text-corpo ${
                    forma === f ? 'border-acc bg-acc-soft font-semibold text-acc-2' : 'border-line-2 bg-surface-2 text-txt'
                  }`}
                >
                  {NOME_DA_FORMA[f]}
                </button>
              ))}
            </div>
          </Card>

          <Button
            largura="cheia"
            carregando={pendente}
            disabled={itens.length === 0 || forma === null}
            motivoDesabilitado={
              itens.length === 0
                ? 'Adicione pelo menos um item para poder fechar a comanda.'
                : 'Escolha como a cliente pagou — é o que permite descontar a taxa da maquininha.'
            }
            onClick={fechar}
          >
            Fechar comanda
          </Button>
        </>
      ) : (
        <p className="text-center text-secundario text-txt-2">
          Comanda fechada{formaFechada ? ` — paga em ${formaFechada}` : ''}. Nada mais pode mudar aqui.
        </p>
      )}
    </div>
  )
}
