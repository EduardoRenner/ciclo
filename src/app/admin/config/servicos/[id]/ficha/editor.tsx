'use client'

import { Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import AlertBanner from '@/components/ui/alert-banner'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { custoDoServico } from '@/core/comanda/custo-do-servico'
import { dinheiro } from '@/lib/formato'

import type { ItemDaFicha } from '@/server/services/ficha-de-consumo'

type Produto = { id: string; name: string; unit: string; avg_cost_cents: number }
type Linha = { productId: string; qty: string }

/**
 * A tela que faltava para `service_products` deixar de ser uma tabela sem escritor (`docs/49`).
 *
 * Ela move duas agulhas de uma vez: a baixa de insumo no fechamento da comanda (TICKET-044, pronta
 * desde sempre e nunca alimentada) e o custo de material do serviço, que é o que faz o "Sobrou"
 * do `docs/48` C1 valer alguma coisa num salão que não vende produto no balcão.
 *
 * E ela existe porque o `docs/47` P02 mede que 73% dos donos não sabem calcular o custo de um
 * serviço. Ninguém aqui pergunta isso: pergunta o que o serviço gasta, que é o que o dono compra e
 * conta todo mês.
 */
export default function EditorDaFicha({
  serviceId,
  inicial,
  produtos,
}: {
  serviceId: string
  inicial: ItemDaFicha[]
  produtos: Produto[]
}) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()
  const [linhas, setLinhas] = useState<Linha[]>(() => inicial.map((i) => ({ productId: i.productId, qty: String(i.qty) })))
  const [erro, setErro] = useState<string | null>(null)

  const porId = new Map(produtos.map((p) => [p.id, p]))
  const disponiveis = produtos.filter((p) => !linhas.some((l) => l.productId === p.id))

  const previsao = custoDoServico(
    linhas.map((l) => ({ qty: Number(l.qty.replace(',', '.')) || 0, avgCostCents: porId.get(l.productId)?.avg_cost_cents ?? 0 })),
    1,
  )

  function adicionar() {
    const primeiro = disponiveis[0]
    if (!primeiro) return
    setLinhas((atual) => [...atual, { productId: primeiro.id, qty: '1' }])
  }

  function salvar() {
    setErro(null)
    iniciarTransicao(async () => {
      try {
        const itens = linhas
          .map((l) => ({ productId: l.productId, qty: Number(l.qty.replace(',', '.')) }))
          .filter((i) => Number.isFinite(i.qty) && i.qty > 0)

        const r = await fetch(`/api/v1/services/${serviceId}/consumption`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ itens }),
        })
        const json = (await r.json()) as { error?: { message: string; details?: { fields?: Record<string, string> } } }
        if (!r.ok) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Nao consegui salvar a ficha.')
          return
        }
        mostrarToast({ tom: 'ok', titulo: 'Ficha salva' })
      } catch {
        // Sem este `catch`, o React 19 relanca para o error boundary da raiz e a tela some
        // levando o que a pessoa preencheu (docs/21 §5.4).
        setErro('Nao consegui falar com o servidor. Confira a conexao e tente de novo.')
      }
    })
  }

  if (produtos.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icone={<Plus aria-hidden className="size-6" />}
          titulo="Nenhum produto cadastrado ainda"
          descricao="A ficha diz quanto de cada produto este serviço gasta. Cadastre os produtos no estoque primeiro, com o quanto você pagou por eles."
          acao={<Link href="/admin/estoque">Ir para o estoque</Link>}
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-0">
        {linhas.length === 0 ? (
          <p className="p-4 text-secundario text-txt-2">
            Este serviço ainda não gasta produto nenhum. Enquanto for assim, o custo de material dele é zero, e o &quot;Sobrou&quot; do caixa
            conta só a comissão e a taxa.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-2">
            {linhas.map((linha, i) => {
              const produto = porId.get(linha.productId)
              return (
                <li key={linha.productId} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-corpo font-semibold">{produto?.name ?? 'Produto removido'}</p>
                    <p className="tabular text-secundario text-txt-2">
                      {produto && produto.avg_cost_cents > 0
                        ? `${dinheiro.format(produto.avg_cost_cents / 100)} por ${produto.unit}`
                        : 'sem custo registrado'}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-2">
                    <span className="sr-only">Quanto de {produto?.name ?? 'produto'} por atendimento</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.001"
                      step="0.001"
                      value={linha.qty}
                      onChange={(e) => setLinhas((atual) => atual.map((l, j) => (j === i ? { ...l, qty: e.target.value } : l)))}
                      className="h-12 w-24 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-right text-corpo tabular text-txt"
                    />
                    <span aria-hidden className="w-8 text-secundario text-txt-2">
                      {produto?.unit ?? ''}
                    </span>
                  </label>
                  <button
                    type="button"
                    aria-label={`Tirar ${produto?.name ?? 'produto'} da ficha`}
                    onClick={() => setLinhas((atual) => atual.filter((_, j) => j !== i))}
                    className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-txt-2"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {disponiveis.length > 0 ? (
        <Button variante="secondary" largura="cheia" onClick={adicionar}>
          <Plus aria-hidden className="size-4" />
          Adicionar produto
        </Button>
      ) : null}

      {/*
        A previsão fica ao lado da edição, e não numa tela de relatório: é ela que responde "quanto
        me custa fazer isso?" enquanto a pessoa ainda pode mudar a resposta. O aviso de produto sem
        custo é a regra do `docs/48` §Fase 3 — estado incompleto honesto, nunca número inventado:
        um insumo sem compra registrada tem custo zero e encolheria o total sem avisar.
      */}
      {linhas.length > 0 ? (
        <Card className="flex items-baseline justify-between gap-3">
          <span className="text-corpo text-txt-2">Custo de produto por atendimento</span>
          <span className="tabular text-stat font-bold text-txt">{dinheiro.format(previsao.custoCents / 100)}</span>
        </Card>
      ) : null}

      {previsao.produtosSemCusto > 0 ? (
        <AlertBanner tom="warn" acao={<Link href="/admin/estoque">Registrar compra</Link>}>
          <p className="text-secundario">
            {previsao.produtosSemCusto === 1
              ? '1 produto da ficha não tem custo registrado, então ele entra como zero nesta conta.'
              : `${previsao.produtosSemCusto} produtos da ficha não têm custo registrado, então eles entram como zero nesta conta.`}
          </p>
        </AlertBanner>
      ) : null}

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}

      <Button largura="cheia" carregando={pendente} onClick={salvar}>
        Salvar ficha
      </Button>
    </div>
  )
}
