'use client'

import { RefreshCw, Send } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import ActionBar from '@/components/ui/action-bar'
import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { useVocabulario } from '@/components/shell/vocabulario'
import { comMaiuscula, plural } from '@/core/text/vocabulario'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import FilterRow from '@/components/ui/filter-row'
import IconeAnel from '@/components/ui/icone-anel'
import Skeleton from '@/components/ui/skeleton'
import StatTile from '@/components/ui/stat-tile'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { recorteDaLista } from '@/core/ciclo/recorte-da-lista'
import { resumoDoEnvio } from '@/core/ciclo/resumo-do-envio'
import { vazioDeRecuperar } from '@/core/ciclo/vazio-de-recuperar'

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

export default function RecuperarReceita({
  inicial,
  podeEnviarEmLote,
  temClientes,
  temCiclos,
  temAtendimentosConcluidos,
  servicosSemMaterial,
}: {
  inicial: ListaRecuperar
  podeEnviarEmLote: boolean
  /**
   * Quantos serviços ativos ainda não têm material confiável. A frase abaixo promete que o lucro
   * é "o que sobra depois da comissão e do produto" — e depois da 0069 o produto vale zero até o
   * dono registrar a compra. Prometer um desconto que não acontece é a família
   * `home-nao-promete-demais`, uma tela para dentro.
   *
   * Aqui a lacuna não é cosmética: ela distorce a ORDEM, que é a única coisa que este número
   * existe para decidir. Sem material, uma coloração parece tão lucrativa quanto um corte do mesmo
   * preço, e o dono gasta o WhatsApp do dia com quem vale menos — exatamente o que a 0067 veio
   * consertar.
   */
  servicosSemMaterial: number
  /** Existe alguma ficha de cliente neste salão. */
  temClientes: boolean
  /** O Motor já calculou algum ciclo — precisa de atendimento CONCLUÍDO, não só de ficha. */
  temCiclos: boolean
  /** Separa "ainda nao atendeu ninguem" de "atendeu e o Motor nao processou". */
  temAtendimentosConcluidos: boolean
}) {
  const vocabulario = useVocabulario()
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
      setAviso(resumoDoEnvio(json.data?.queued ?? 0, (json.data?.skipped ?? []).map((s) => s.reason)))
      setSelecionados(new Set())
      await trocarFiltro(filtro)
    } finally {
      setEnviando(false)
    }
  }

  const recorte = recorteDaLista(lista.count, lista.items.length)
  const itensSelecionados = lista.items.filter((i) => selecionados.has(chave(i)))
  // O bloqueio só aparece quando ela realmente pediu o lote. Com uma cliente marcada o caminho
  // grátis atende, e mostrar oferta de plano ali seria vender no meio de uma tarefa que funciona.
  const bloqueado = !podeEnviarEmLote && itensSelecionados.length > 1
  const valorSelecionadoCents = itensSelecionados.reduce((soma, i) => soma + i.valueCents, 0)

  return (
    <div>
      {/*
        O número era "Valor parado" e ninguém tinha como entendê-lo: §5.3 define
        valor em risco como `preço do serviço × chance de recuperação por
        estado`, então numa barbearia de corte a R$ 45 a linha de uma cliente
        aparecia como R$ 5,40 — nem o preço, nem o total, e sem explicação em
        lugar nenhum da tela. O número continua o mesmo; o que mudou é o rótulo
        dizer o que ele é.

        E, desde a `0067` (`docs/48` C3), ele deixou de ser o único: ao lado da
        receita está o que SOBRA dela, e é o lucro que ORDENA a lista. Um
        platinado de R$ 200 com 60% de comissão e R$ 30 de produto deixa menos
        que um corte de R$ 80 sem comissão — ordenar por receita mandava o dono
        gastar o WhatsApp do dia com quem vale menos.
      */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatTile rotulo="Dá para recuperar" valor={dinheiro.format(lista.totalValueCents / 100)} apoio={`${dinheiro.format(lista.totalProfitCents / 100)} de lucro`} />
        <StatTile rotulo={comMaiuscula(plural(vocabulario.cliente))} valor={String(lista.count)} />
      </div>

      <p className="mb-4 text-secundario text-txt-3">
        Estimativa, não promessa: o preço do serviço de cada uma, multiplicado pela chance de ela voltar. Quanto mais
        tempo sem aparecer, menor a chance, e por isso quem sumiu há mais tempo vale menos aqui. A ordem da lista segue o
        <strong> lucro</strong>, o que sobra depois da comissão{servicosSemMaterial > 0 ? '' : ' e do produto'}, não o preço.
      </p>

      {servicosSemMaterial > 0 ? (
        <p className="mb-4 text-secundario text-txt-3">
          O produto ainda não entra nesta conta: {servicosSemMaterial === 1 ? '1 serviço' : `${servicosSemMaterial} serviços`} sem o custo
          registrado. Enquanto isso, um serviço que gasta material parece tão lucrativo quanto um que não gasta, e é a ordem desta lista que
          fica errada.{' '}
          <Link href="/admin/config/servicos" className="font-semibold text-acc-2">
            Completar o custo
          </Link>
        </p>
      ) : null}

      <FilterRow rotulo="Filtrar por estado do ciclo" className="mb-4">
        {FILTROS.map((f) => (
          <Chip key={f.valor} ligado={filtro === f.valor} onClick={() => trocarFiltro(f.valor)}>
            {f.rotulo}
          </Chip>
        ))}
      </FilterRow>

      {/*
        Mesmo defeito que a página pública de agendamento tinha, e nesta tela dói mais: aqui é o
        Motor de Ciclo, o diferencial que sustenta o preço do produto. Trocar o filtro recarrega a
        lista E os dois números do topo, sem trocar de rota — e, para quem usa leitor de tela, nada
        avisava que a escolha surtiu efeito.

        A região vive SEMPRE no DOM, mesmo vazia: leitor de tela precisa observar o nó antes de o
        texto mudar. Região que nasce junto com o conteúdo costuma não ser anunciada — é o erro que
        deixaria o atributo presente e o anúncio inútil.

        O texto sai do MESMO `lista` que desenha os StatTiles, então o que se lê e o que se vê não
        podem divergir.
      */}
      <p aria-live="polite" className="sr-only">
        {carregando
          ? 'Carregando a lista.'
          : `${lista.count} ${lista.count === 1 ? 'cliente' : 'clientes'}, ${dinheiro.format(lista.totalValueCents / 100)} para recuperar.${recorte ? ` ${recorte}` : ''}`}
      </p>

      {/*
        O recorte vai para os DOIS lugares pelo mesmo motivo que o resto desta tela: quem enxerga
        lê a linha abaixo, quem usa leitor de tela ouve a região viva acima. Sai do mesmo `lista`
        que desenha os StatTiles, então o número que se ouve e o que se vê não podem divergir.
      */}
      {!carregando && recorte ? <p className="mb-3 text-secundario text-txt-2">{recorte}</p> : null}

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
          {/*
            Três situações diferentes usavam a MESMA frase, e só uma delas é boa notícia. A ação
            era `<span>Volte mais tarde</span>` — texto vestido de saída, que satisfazia o tipo
            obrigatório de `EmptyState` sem cumprir o que ele existe para garantir ("tela vazia sem
            saída é beco sem saída"). Virou visível quando esta tela passou a ser o botão CENTRAL da
            barra em 31/08: é a primeira coisa que um salão novo toca.
          */}
          <EmptyStateDeRecuperar
            temClientes={temClientes}
            temCiclos={temCiclos}
            temAtendimentosConcluidos={temAtendimentosConcluidos}
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
                    <p className="tabular text-label text-txt-3">{dinheiro.format(item.profitCents / 100)} de lucro</p>
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
        {bloqueado ? (
          /*
            §M.1: a peça de conversão mais importante do produto aparece AQUI, no momento em que
            ela marcou oito clientes e tocou para avisar — não numa página de preço que ela teria
            de ir procurar. Por isso leva o número e o valor DELA, e por isso o caminho grátis
            (avisar uma de cada vez, pelo botão de cada linha) fica escrito e continua valendo.

            Sem as bordas próprias: a ActionBar já é o cartão.
          */
          <BloqueioPlano
            className="border-0 bg-transparent p-1 shadow-none"
            precisaDo="essencial"
            acao="avisar todas de uma vez"
            evidencia={{
              quantidade: itensSelecionados.length,
              substantivo: 'clientes marcadas, esperando para voltar',
              valorCents: valorSelecionadoCents,
            }}
            alternativa={
              <button type="button" onClick={() => setSelecionados(new Set())}>
                Avisar uma de cada vez, de graça
              </button>
            }
          />
        ) : (
          <Button
            largura="cheia"
            carregando={enviando}
            onClick={() => enviar(itensSelecionados)}
            // `tabIndex` acompanha a visibilidade: barra escondida não pode ser
            // alcançada pelo teclado nem lida pelo leitor de tela.
            tabIndex={itensSelecionados.length > 0 ? undefined : -1}
          >
            <Send aria-hidden className="size-4" />
            {`Avisar ${itensSelecionados.length}`}
          </Button>
        )}
      </ActionBar>
    </div>
  )
}

/** So a marcacao: qual frase mostrar e decisao pura em `core/ciclo/vazio-de-recuperar.ts`. */
function EmptyStateDeRecuperar({
  temClientes,
  temCiclos,
  temAtendimentosConcluidos,
}: {
  temClientes: boolean
  temCiclos: boolean
  temAtendimentosConcluidos: boolean
}) {
  const v = vazioDeRecuperar(temClientes, temCiclos, temAtendimentosConcluidos)
  return (
    <EmptyState
      icone={<IconeAnel aria-hidden className="size-6" />}
      titulo={v.titulo}
      descricao={v.descricao}
      acao={
        /*
          Quando ha atendimento concluido e nao ha ciclo, quem nao rodou foi o JOB. Mandar a pessoa
          para outra tela seria oferecer distracao, nao saida — a saida de verdade e disparar o
          recalculo. Nas outras tres situacoes o link continua sendo a acao certa.
        */
        temAtendimentosConcluidos && !temCiclos ? (
          <BotaoRecalcular rotuloAlternativo={v.acaoRotulo} hrefAlternativo={v.acaoHref} />
        ) : (
          <Link href={v.acaoHref} className="text-corpo font-semibold text-acc-2">
            {v.acaoRotulo}
          </Link>
        )
      }
    />
  )
}

/**
 * A escapatoria para quando o agendador cai.
 *
 * `fetch` cru e nao `apiFetch`: aquele ENFILEIRA quando a rede falha, e um recalculo que roda tres
 * horas depois, sozinho, nao e o que a pessoa pediu — ela quer ver a tela mudar agora. Aqui, falha
 * de rede vira aviso e a pessoa decide se tenta de novo.
 *
 * O `try` em volta do `await` nao e zelo: no React 19 uma Action que rejeita e RE-LANCADA para o
 * error boundary, entao uma piscada de 4G derrubaria a tela inteira em vez de mostrar um toast.
 * Ha linha de base em `tests/unit/design/rede-nao-derruba-tela.test.ts`.
 */
function BotaoRecalcular({ rotuloAlternativo, hrefAlternativo }: { rotuloAlternativo: string; hrefAlternativo: string }) {
  const [pendente, iniciar] = useTransition()
  const [falhou, setFalhou] = useState(false)
  const router = useRouter()
  const toast = useToast()

  function recalcular() {
    iniciar(async () => {
      try {
        const r = await fetch('/api/v1/cycles/recompute', { method: 'POST' })
        const corpo = (await r.json().catch(() => null)) as { data?: { ciclos?: number }; error?: { message?: string } } | null

        if (!r.ok) {
          setFalhou(true)
          toast({ tom: 'erro', titulo: 'Não consegui recalcular agora', descricao: corpo?.error?.message })
          return
        }

        const ciclos = corpo?.data?.ciclos ?? 0
        toast({
          tom: ciclos > 0 ? 'ok' : 'aviso',
          titulo: ciclos > 0 ? 'Motor atualizado' : 'Nada para calcular ainda',
          // Nunca "pronto!" seco: o numero e a prova de que aconteceu alguma coisa.
          descricao: ciclos > 0 ? `${ciclos} ${ciclos === 1 ? 'previsão recalculada' : 'previsões recalculadas'}.` : undefined,
        })
        router.refresh()
      } catch {
        setFalhou(true)
        toast({ tom: 'erro', titulo: 'Sem conexão', descricao: 'Tente de novo quando a internet voltar.' })
      }
    })
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={recalcular} carregando={pendente} tamanho="md">
        <RefreshCw aria-hidden className={cn('size-4', pendente && 'animate-spin')} />
        Recalcular agora
      </Button>
      {/* Depois de falhar, a tela deixa de ser beco: a saida antiga volta como plano B. */}
      {falhou ? (
        <Link href={hrefAlternativo} className="text-label font-semibold text-txt-2">
          {rotuloAlternativo}
        </Link>
      ) : null}
    </div>
  )
}
