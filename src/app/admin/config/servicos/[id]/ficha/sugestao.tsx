'use client'

import { useState, useTransition } from 'react'

import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Select from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'
import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'

type ProdutoDeRevenda = { id: string; name: string; price_cents: number; stock_qty: number }

/**
 * 0091 — pedido direto do Eduardo: quando a cliente marca este serviço, oferecer um produto de
 * revenda relacionado (corte de cabelo → máscara de hidratação). NÃO é desconto automático (a
 * porta que `core/agenda/ociosidade.ts` já mantém fechada) e não usa prazo/contador inventado
 * (`docs/30` §5.10): o servidor só guarda QUAL produto combina com este serviço; quem decide
 * oferecer e a que preço continua sendo o profissional na comanda, na hora de fechar de verdade.
 *
 * No máximo um produto por serviço no MVP — dado real primeiro, lista de N depois se fizer falta.
 */
export default function SugestaoDeProduto({
  serviceId,
  produtoSugeridoId,
  produtos,
}: {
  serviceId: string
  produtoSugeridoId: string | null
  produtos: ProdutoDeRevenda[]
}) {
  const mostrarToast = useToast()
  const [pendente, iniciarTransicao] = useTransition()
  const [selecionado, setSelecionado] = useState(produtoSugeridoId ?? '')
  const [erro, setErro] = useState<string | null>(null)

  function salvar(valor: string) {
    setErro(null)
    setSelecionado(valor)
    iniciarTransicao(async () => {
      try {
        const r = await fetch(`/api/v1/services/${serviceId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({ suggestedProductId: valor || null }),
        })
        const json = (await r.json()) as { error?: { message: string } }
        if (!r.ok) {
          setSelecionado(produtoSugeridoId ?? '')
          setErro(json.error?.message ?? 'Não consegui salvar a sugestão.')
          return
        }
        mostrarToast({ tom: 'ok', titulo: valor ? 'Sugestão salva' : 'Sugestão removida' })
      } catch {
        setSelecionado(produtoSugeridoId ?? '')
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  if (produtos.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icone={<ShoppingBag aria-hidden className="size-6" />}
          titulo="Nenhum produto de revenda ainda"
          descricao="Cadastre um produto de revenda (com preço) no estoque para poder oferecê-lo junto com este serviço."
          acao={<Link href="/admin/estoque">Ir para o estoque</Link>}
        />
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className="text-corpo font-semibold">Leva junto</p>
        <p className="mt-0.5 text-secundario text-txt-2">
          Quem marcar este serviço vê esse produto na hora de agendar. Ninguém é cobrado aqui — é o profissional quem lança na comanda, se a
          cliente quiser mesmo.
        </p>
      </div>

      <Select
        rotulo="Produto oferecido"
        value={selecionado}
        onChange={(e) => salvar(e.target.value)}
        disabled={pendente}
      >
        <option value="">Nenhum</option>
        {produtos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {dinheiro.format(p.price_cents / 100)}
            {p.stock_qty <= 0 ? ' · sem estoque' : ''}
          </option>
        ))}
      </Select>

      {erro ? (
        <p role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : null}
    </Card>
  )
}
