'use client'

import { PackagePlus, PackageX } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Input from '@/components/ui/input'
import MoneyInput from '@/components/ui/money-input'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'

export type ProdutoEstoque = {
  id: string
  nome: string
  unidade: string
  estoque: number
  pontoDePedido: number
  custoMedioCents: number
  venceEm: string | null
  emAlerta: boolean
}

/** `numeric(12,3)` chega como número com casas que ninguém quer ler ("12.000 un"). */
function quantidade(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function diasAte(iso: string): number {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const alvo = Date.UTC(ano!, mes! - 1, dia!)
  const hoje = new Date()
  const inicioDeHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  return Math.round((alvo - inicioDeHoje) / 86_400_000)
}

export default function ListaEstoque({ produtos }: { produtos: ProdutoEstoque[] }) {
  const mostrarToast = useToast()
  const [lista, setLista] = useState(produtos)
  const [entrando, setEntrando] = useState<ProdutoEstoque | null>(null)

  // Alerta em cima: quem abre esta tela veio resolver o aviso de "Hoje".
  const ordenados = [...lista].sort((a, b) => Number(b.emAlerta) - Number(a.emAlerta) || a.nome.localeCompare(b.nome, 'pt-BR'))

  if (lista.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icone={<PackageX aria-hidden className="size-6" />}
          titulo="Nenhum produto cadastrado"
          descricao="Os produtos vêm do pacote da sua profissão e do que você usa nos serviços. Cadastre um serviço para o catálogo aparecer aqui."
          acao={<Link href="/admin/config/servicos">Ver serviços</Link>}
        />
      </Card>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {ordenados.map((p) => {
          const dias = p.venceEm ? diasAte(p.venceEm) : null
          return (
            <Card key={p.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-corpo font-semibold">{p.nome}</p>
                  {dias !== null && dias <= 0 ? (
                    <Badge estado="bad">Vencido</Badge>
                  ) : dias !== null && dias <= 30 ? (
                    <Badge estado="warn">Vence em {dias}d</Badge>
                  ) : p.emAlerta ? (
                    <Badge estado="warn">Repor</Badge>
                  ) : null}
                </div>
                <p className="tabular mt-0.5 text-secundario text-txt-2">
                  {quantidade(p.estoque)} {p.unidade}
                  {p.pontoDePedido > 0 ? ` · repor com ${quantidade(p.pontoDePedido)}` : ''}
                  {p.custoMedioCents > 0 ? ` · ${dinheiro.format(p.custoMedioCents / 100)} cada` : ''}
                </p>
              </div>
              <Button tamanho="sm" variante="secondary" onClick={() => setEntrando(p)}>
                Entrada
              </Button>
            </Card>
          )
        })}
      </div>

      {entrando ? (
        <FormularioEntrada
          produto={entrando}
          aoFechar={() => setEntrando(null)}
          aoSalvar={(id, estoque, custoMedioCents) => {
            setLista((atual) =>
              atual.map((p) => (p.id === id ? { ...p, estoque, custoMedioCents, emAlerta: estoque <= p.pontoDePedido } : p)),
            )
            mostrarToast({ tom: 'ok', titulo: 'Entrada registrada', descricao: 'O estoque e o custo médio já estão atualizados.' })
          }}
        />
      ) : null}
    </>
  )
}

function FormularioEntrada({
  produto,
  aoFechar,
  aoSalvar,
}: {
  produto: ProdutoEstoque
  aoFechar: () => void
  aoSalvar: (id: string, estoque: number, custoMedioCents: number) => void
}) {
  const [qtd, setQtd] = useState('')
  // Começa no custo médio que já existe: repor pelo mesmo preço é o caso comum,
  // e digitar de novo o que o sistema já sabe é atrito à toa.
  const [custoCents, setCustoCents] = useState(produto.custoMedioCents)
  const [nota, setNota] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciarSalvamento] = useTransition()

  const quantidadeValida = Number(qtd.replace(',', '.')) > 0

  function salvar() {
    const valor = Number(qtd.replace(',', '.'))
    if (!(valor > 0)) {
      setErro('Diga quantas unidades entraram.')
      return
    }
    setErro(null)

    iniciarSalvamento(async () => {
      const r = await fetch('/api/v1/inventory/entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          productId: produto.id,
          qty: valor,
          unitCostCents: custoCents,
          note: nota.trim() || undefined,
        }),
      })
      const json = (await r.json()) as { data?: { stock_qty: number; avg_cost_cents: number }; error?: { message: string } }
      if (!r.ok || !json.data) {
        setErro(json.error?.message ?? 'Não consegui registrar a entrada. Tente de novo.')
        return
      }
      aoSalvar(produto.id, json.data.stock_qty, json.data.avg_cost_cents)
      aoFechar()
    })
  }

  return (
    <Sheet
      aberto
      aoFechar={(aberto) => !aberto && aoFechar()}
      titulo={`Entrada de ${produto.nome}`}
      descricao="Registre a compra: o estoque sobe e o custo médio é recalculado."
    >
      <div className="flex flex-col gap-3">
        <Input
          rotulo={`Quantidade (${produto.unidade})`}
          value={qtd}
          onChange={(e) => setQtd(e.target.value)}
          inputMode="decimal"
          autoFocus
          ajuda={`Tem ${quantidade(produto.estoque)} ${produto.unidade} agora.`}
        />
        <MoneyInput
          rotulo="Quanto custou cada uma"
          centavos={custoCents}
          aoMudar={setCustoCents}
          ajuda="É este valor que faz o custo do atendimento sair do zero."
        />
        <Input rotulo="Observação (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button
          largura="cheia"
          carregando={salvando}
          disabled={!quantidadeValida}
          motivoDesabilitado="Preencha a quantidade que entrou."
          onClick={salvar}
        >
          <PackagePlus aria-hidden className="size-4" />
          Registrar entrada
        </Button>
      </div>
    </Sheet>
  )
}
