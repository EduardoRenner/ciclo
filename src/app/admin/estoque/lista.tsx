'use client'

import { PackagePlus, PackageX, Pencil, Plus } from 'lucide-react'
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
  /** docs/62 Fase 1: `null` = insumo, sem preço de venda. Presente só quando `isRetail`. */
  precoCents: number | null
  /** `true` = revenda (a cliente leva); `false` = insumo (o serviço consome). */
  isRetail: boolean
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
  // docs/62 Fase 1: `'novo'` abre o formulário vazio; um produto abre pra edição.
  const [editando, setEditando] = useState<ProdutoEstoque | 'novo' | null>(null)

  // Alerta em cima: quem abre esta tela veio resolver o aviso de "Hoje".
  const ordenados = [...lista].sort((a, b) => Number(b.emAlerta) - Number(a.emAlerta) || a.nome.localeCompare(b.nome, 'pt-BR'))

  function aoSalvarProduto(produto: ProdutoEstoque, ehNovo: boolean) {
    setLista((atual) => (ehNovo ? [...atual, produto] : atual.map((p) => (p.id === produto.id ? produto : p))))
    mostrarToast({ tom: 'ok', titulo: ehNovo ? 'Produto cadastrado' : 'Produto atualizado' })
  }

  const botaoNovoProduto = (
    <Button
      tamanho="sm"
      variante="secondary"
      disabled={!podeLancar}
      motivoDesabilitado={podeLancar ? undefined : 'Cadastrar produto é do plano Avançado'}
      onClick={() => setEditando('novo')}
    >
      <Plus aria-hidden className="size-4" />
      Novo produto
    </Button>
  )

  const emAlerta = ordenados.filter((p) => p.emAlerta).length
  if (lista.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">{botaoNovoProduto}</div>
        <Card className="p-0">
          <EmptyState
            icone={<PackageX aria-hidden className="size-6" />}
            titulo="Nenhum produto cadastrado"
            descricao="Os produtos vêm do pacote da sua profissão e do que você usa nos serviços. Ou cadastre um agora, pra vender ou só controlar o estoque."
            acao={<Link href="/admin/config/servicos">Ver serviços</Link>}
          />
        </Card>
        {editando ? (
          <FormularioProduto
            produto={editando === 'novo' ? null : editando}
            aoFechar={() => setEditando(null)}
            aoSalvar={(produto) => aoSalvarProduto(produto, editando === 'novo')}
          />
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="mb-2 flex justify-end">{botaoNovoProduto}</div>
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
                  {/* docs/62 Fase 1: sinal visual de qual das duas naturezas é este produto — a
                      separação em duas seções com margem fica pra Fase 2, isto já distingue. */}
                  {p.isRetail ? <Badge estado="ok">Revenda</Badge> : null}
                </div>
                <p className="tabular mt-0.5 text-secundario text-txt-2">
                  {quantidade(p.estoque)} {p.unidade}
                  {p.pontoDePedido > 0 ? ` · repor com ${quantidade(p.pontoDePedido)}` : ''}
                  {p.custoMedioCents > 0 ? ` · ${dinheiro.format(p.custoMedioCents / 100)} custo` : ''}
                  {p.isRetail && p.precoCents != null ? ` · vende por ${dinheiro.format(p.precoCents / 100)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button tamanho="sm" variante="secondary" aria-label={`Editar ${p.nome}`} onClick={() => setEditando(p)}>
                  <Pencil aria-hidden className="size-4" />
                </Button>
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
              </div>
            </Card>
          )
        })}
      </div>

      {editando ? (
        <FormularioProduto
          produto={editando === 'novo' ? null : editando}
          aoFechar={() => setEditando(null)}
          aoSalvar={(produto) => aoSalvarProduto(produto, editando === 'novo')}
        />
      ) : null}

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

/**
 * docs/62 Fase 1: cadastro e edição de produto — o alicerce que faltava. `produto === null` é
 * criação; com produto, edição (PATCH). O toggle "Vende para cliente" é o `is_retail` que
 * `comanda.ts` já sabia ler mas ninguém tinha como escrever: revenda (shampoo, óleo de barba,
 * o que a cliente leva pra casa) tem preço; insumo (água oxigenada, luva, o que o serviço
 * consome) não — o preço só aparece quando o toggle liga.
 */
function FormularioProduto({
  produto,
  aoFechar,
  aoSalvar,
}: {
  produto: ProdutoEstoque | null
  aoFechar: () => void
  aoSalvar: (produto: ProdutoEstoque) => void
}) {
  const editando = produto !== null
  const [nome, setNome] = useState(produto?.nome ?? '')
  const [unidade, setUnidade] = useState(produto?.unidade ?? 'un')
  const [custoCents, setCustoCents] = useState(produto?.custoMedioCents ?? 0)
  const [isRetail, setIsRetail] = useState(produto?.isRetail ?? false)
  const [precoCents, setPrecoCents] = useState(produto?.precoCents ?? 0)
  const [pontoDePedido, setPontoDePedido] = useState(produto && produto.pontoDePedido > 0 ? String(produto.pontoDePedido) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, iniciarSalvamento] = useTransition()

  function salvar() {
    if (nome.trim().length < 2) {
      setErro('Dê um nome ao produto.')
      return
    }
    setErro(null)

    const pontoDigitado = pontoDePedido.trim() === '' ? undefined : Number(pontoDePedido.replace(',', '.'))

    iniciarSalvamento(async () => {
      try {
        const url = editando ? `/api/v1/products/${produto.id}` : '/api/v1/products'
        const r = await fetch(url, {
          method: editando ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
          body: JSON.stringify({
            name: nome.trim(),
            unit: unidade.trim() || 'un',
            avgCostCents: custoCents,
            isRetail,
            priceCents: isRetail ? precoCents : null,
            ...(pontoDigitado !== undefined ? { reorderPoint: pontoDigitado } : {}),
          }),
        })
        const json = (await r.json()) as {
          data?: {
            id: string
            name: string
            unit: string
            stock_qty: number
            reorder_point: number
            avg_cost_cents: number
            price_cents: number | null
            is_retail: boolean
            expires_at: string | null
          }
          error?: { message: string; details?: { fields?: Record<string, string> } }
        }
        if (!r.ok || !json.data) {
          const campo = json.error?.details?.fields ? Object.values(json.error.details.fields)[0] : undefined
          setErro(campo ?? json.error?.message ?? 'Não consegui salvar o produto.')
          return
        }
        aoSalvar({
          id: json.data.id,
          nome: json.data.name,
          unidade: json.data.unit,
          estoque: json.data.stock_qty,
          pontoDePedido: json.data.reorder_point,
          custoMedioCents: json.data.avg_cost_cents,
          precoCents: json.data.price_cents,
          isRetail: json.data.is_retail,
          venceEm: json.data.expires_at,
          emAlerta: produto?.emAlerta ?? false,
        })
        aoFechar()
      } catch {
        // Rede caiu antes de chegar resposta — sem isto, o React 19 relança para o error
        // boundary da raiz e a tela inteira some (docs/21 §5.4).
        setErro('Não consegui falar com o servidor. Confira a conexão e tente de novo.')
      }
    })
  }

  return (
    <Sheet aberto aoFechar={(aberto) => !aberto && aoFechar()} titulo={editando ? 'Editar produto' : 'Novo produto'}>
      <div className="flex flex-col gap-3">
        <Input rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus required />
        <Input rotulo="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un, ml, g..." />
        <MoneyInput rotulo="Custo (opcional)" centavos={custoCents} aoMudar={setCustoCents} ajuda="Pode deixar em zero e ajustar na próxima compra." />

        <label className="flex min-h-12 items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={isRetail}
            onChange={(e) => setIsRetail(e.target.checked)}
            className="size-5 rounded border-line-2 bg-surface-2"
          />
          <span className="text-corpo text-txt">Vende para cliente (revenda)</span>
        </label>
        <p className="-mt-2 text-secundario text-txt-2">
          {isRetail
            ? 'Revenda: quem é atendido leva pra casa (xampu, óleo de barba). Precisa de preço.'
            : 'Insumo de uso interno (água oxigenada, luva): o serviço consome, sem preço próprio.'}
        </p>

        {isRetail ? <MoneyInput rotulo="Preço de venda" centavos={precoCents} aoMudar={setPrecoCents} required /> : null}

        <Input
          rotulo="Me avise quando sobrar menos que (opcional)"
          value={pontoDePedido}
          onChange={(e) => setPontoDePedido(e.target.value)}
          inputMode="decimal"
        />

        {erro ? (
          <p role="alert" className="text-secundario text-bad">
            {erro}
          </p>
        ) : null}

        <Button largura="cheia" carregando={salvando} onClick={salvar}>
          {editando ? 'Salvar' : 'Cadastrar produto'}
        </Button>
      </div>
    </Sheet>
  )
}
