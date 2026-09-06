'use client'

import { PackagePlus, PackageX } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import Badge from '@/components/ui/badge'
import BloqueioPlano from '@/components/ui/bloqueio-plano'
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

export default function ListaEstoque({
  produtos,
  podeLancar,
}: {
  produtos: ProdutoEstoque[]
  /**
   * O plano do salão libera `stock`. A tela CONTINUA visível sem ele — regra 5.2: bloqueio mostra
   * o motivo e o caminho, e sumir com o item esconderia o que dá para comprar.
   */
  podeLancar: boolean
}) {
  const mostrarToast = useToast()
  const [lista, setLista] = useState(produtos)
  const [entrando, setEntrando] = useState<ProdutoEstoque | null>(null)

  // Alerta em cima: quem abre esta tela veio resolver o aviso de "Hoje".
  const ordenados = [...lista].sort((a, b) => Number(b.emAlerta) - Number(a.emAlerta) || a.nome.localeCompare(b.nome, 'pt-BR'))


  const emAlerta = ordenados.filter((p) => p.emAlerta).length
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
              {/*
                Sem o módulo, o botão trava AQUI e diz por quê — em vez de abrir o formulário,
                deixar a pessoa preencher quantidade e custo, e só então a rota recusar
                (`exigirModulo(..., 'stock')` em `inventory/entries`). Trabalho jogado fora é a
                pior forma de descobrir que o recurso é pago.
              */}
              <Button
                tamanho="sm"
                variante="secondary"
                disabled={!podeLancar}
                motivoDesabilitado={podeLancar ? undefined : 'Registrar compra é do plano Avançado'}
                onClick={() => setEntrando(p)}
              >
                Entrada
              </Button>
            </Card>
          )
        })}
      </div>

      {!podeLancar ? (
        /*
          Vem DEPOIS da lista de propósito: quem chega aqui veio olhar o estoque, e o número de
          produtos abaixo do ponto de recompra é o argumento — §M.1 diz que o que converte é o
          valor concreto com o dado dela, não o folheto.
        */
        <BloqueioPlano
          className="mt-4"
          precisaDo="avancado"
          acao="registrar compra e manter o estoque em dia"
          evidencia={{ quantidade: emAlerta, substantivo: 'produtos abaixo do ponto de recompra' }}
        />
      ) : null}

      {entrando ? (
        <FormularioEntrada
          produto={entrando}
          aoFechar={() => setEntrando(null)}
          aoSalvar={(id, estoque, custoMedioCents, pontoDePedido) => {
            setLista((atual) =>
              // `pontoDePedido` vem da RESPOSTA, não do estado antigo da linha: quem acabou de
              // definir o aviso precisa ver o selo "Repor" recalculado com o valor que gravou.
              atual.map((p) => (p.id === id ? { ...p, estoque, custoMedioCents, pontoDePedido, emAlerta: estoque <= pontoDePedido } : p)),
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
  aoSalvar: (id: string, estoque: number, custoMedioCents: number, pontoDePedido: number) => void
}) {
  const [qtd, setQtd] = useState('')
  // Começa no custo médio que já existe: repor pelo mesmo preço é o caso comum,
  // e digitar de novo o que o sistema já sabe é atrito à toa.
  const [custoCents, setCustoCents] = useState(produto.custoMedioCents)
  const [nota, setNota] = useState('')
  const [pontoDePedido, setPontoDePedido] = useState(produto.pontoDePedido > 0 ? String(produto.pontoDePedido) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciarSalvamento] = useTransition()

  const quantidadeValida = Number(qtd.replace(',', '.')) > 0
  const pontoDigitado = Number(pontoDePedido.replace(',', '.'))
  const pontoValido = pontoDePedido.trim() !== '' && Number.isFinite(pontoDigitado) && pontoDigitado >= 0

  function salvar() {
    const valor = Number(qtd.replace(',', '.'))
    if (!(valor > 0)) {
      setErro('Diga quantas unidades entraram.')
      return
    }
    setErro(null)

    iniciarSalvamento(async () => {
      try {
        const r = await fetch('/api/v1/inventory/entries', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            productId: produto.id,
            qty: valor,
            unitCostCents: custoCents,
            note: nota.trim() || undefined,
            // Campo vazio = "não mexi nisso": manda `undefined` e o serviço preserva o valor
            // atual. Zero digitado é escolha válida ("não me avise por quantidade") e precisa
            // chegar como zero, por isso o teste é em string vazia e não em falsy.
            //
            // `pontoValido` também barra `NaN`: `JSON.stringify(NaN)` vira `null`, e `null` num
            // campo opcional é rejeitado pelo Zod com uma mensagem que não diz o que fazer.
            reorderPoint: pontoValido ? Number(pontoDePedido.replace(',', '.')) : undefined,
          }),
        })
        const json = (await r.json()) as {
          data?: { stock_qty: number; avg_cost_cents: number; reorder_point: number }
          error?: { message: string }
        }
        if (!r.ok || !json.data) {
          setErro(json.error?.message ?? 'Não consegui registrar a entrada. Tente de novo.')
          return
        }
        aoSalvar(produto.id, json.data.stock_qty, json.data.avg_cost_cents, json.data.reorder_point)
        aoFechar()
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
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
        {/*
          `reorder_point` era lida em três lugares e escrita em nenhum — não havia onde definir.
          O efeito não era o alerta sumir, era chegar tarde: a regra é "estoque ≤ ponto **ou**
          cobertura < 7 dias", e com o ponto sempre em 0 a primeira metade só disparava com o
          produto já acabado.

          Fica aqui, e não numa tela de edição de produto, porque quem registra a compra é quem
          acabou de decidir quanto precisa ter em mãos — é a mesma decisão, no mesmo instante.
        */}
        <Input
          rotulo="Me avise quando sobrar menos que (opcional)"
          value={pontoDePedido}
          onChange={(e) => setPontoDePedido(e.target.value)}
          inputMode="decimal"
          ajuda={
            produto.pontoDePedido > 0
              ? `Hoje o aviso é em ${quantidade(produto.pontoDePedido)} ${produto.unidade}.`
              : 'Sem isso, o aviso só chega quando o produto acaba.'
          }
        />
        <Input rotulo="Observação (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} />

        {pontoDePedido.trim() !== '' && !pontoValido ? (
          <p role="alert" className="text-secundario text-bad">
            O aviso precisa ser um número de {produto.unidade}. Deixe em branco para não mudar.
          </p>
        ) : null}

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button
          largura="cheia"
          carregando={salvando}
          disabled={!quantidadeValida || (pontoDePedido.trim() !== '' && !pontoValido)}
          motivoDesabilitado={quantidadeValida ? 'Corrija o aviso de estoque baixo.' : 'Preencha a quantidade que entrou.'}
          onClick={salvar}
        >
          <PackagePlus aria-hidden className="size-4" />
          Registrar entrada
        </Button>
      </div>
    </Sheet>
  )
}
