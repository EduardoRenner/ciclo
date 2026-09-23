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
import { ASSUNTO_MOTOR_PARADO, canalDeContato } from '@/lib/contato'
import { linkWhatsAppCompartilhar, textoDeVolta } from '@/lib/mensagens'
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
  nativo,
  temClientes,
  temCiclos,
  temAtendimentosConcluidos,
  servicosSemMaterial,
}: {
  inicial: ListaRecuperar
  podeEnviarEmLote: boolean
  /** T1.5 (docs/64 §0.2) — calculado no servidor (`page.tsx`), repassado pro `BloqueioPlano`. */
  nativo: boolean
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
  const mostrarToast = useToast()
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
      // Sem checar `r.ok`, um 401/500 caía direto em `json.data` undefined e `if (json.data)`
      // simplesmente não fazia nada — a lista antiga continuava na tela, sem aviso nenhum de que o
      // filtro não trocou. `BotaoRecalcular`, no mesmo arquivo, já usa toast pra isto.
      if (!r.ok) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui atualizar a lista', descricao: 'Tente trocar o filtro de novo.' })
        return
      }
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
      /*
       * Sem checar `r.ok`, uma falha (401/500) caía nos mesmos `??` de baixo e virava
       * `resumoDoEnvio(0, [])` — a MESMA frase de "não tinha ninguém pra mandar", quando na
       * verdade a requisição nem foi processada. A pessoa lia como se tivesse dado certo e não
       * tentava de novo.
       */
      if (!r.ok) {
        const corpo = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
        mostrarToast({ tom: 'erro', titulo: 'Não consegui enviar', descricao: corpo?.error?.message ?? 'Tente de novo.' })
        return
      }
      const json = (await r.json()) as { data?: { queued: number; skipped: { clientId: string; reason: string }[] } }
      setAviso(resumoDoEnvio(json.data?.queued ?? 0, (json.data?.skipped ?? []).map((s) => s.reason)))
      setSelecionados(new Set())
      await trocarFiltro(filtro)
    } finally {
      setEnviando(false)
    }
  }

  /*
    `docs/82` §7: o toque em "Chamar" abre o WhatsApp do dono numa aba nova e, em paralelo, anota a
    chamada — é o que faz a volta dessa pessoa contar em "O Motor de Ciclo trouxe". Falha aqui não
    pode travar a conversa que já abriu: vira aviso, e o dono segue no WhatsApp.
  */
  async function anotarChamada(item: ItemRecuperar) {
    try {
      const r = await fetch('/api/v1/cycle/recover/manual', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ clientId: item.clientId, serviceId: item.serviceId }),
      })
      if (!r.ok) throw new Error(String(r.status))
      mostrarToast({ tom: 'ok', titulo: 'Anotado', descricao: `Se ${item.name.split(' ')[0]} marcar, a volta conta para o Motor de Ciclo.` })
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui anotar a chamada', descricao: 'A mensagem no WhatsApp não muda. Só esta volta pode não aparecer no que o Motor trouxe.' })
    }
  }

  const recorte = recorteDaLista(lista.count, lista.items.length)
  const itensSelecionados = lista.items.filter((i) => selecionados.has(chave(i)))
  // O bloqueio só aparece quando ela realmente pediu o lote. Com uma cliente marcada o caminho
  // grátis atende, e mostrar oferta de plano ali seria vender no meio de uma tarefa que funciona.
  const bloqueado = !podeEnviarEmLote && itensSelecionados.length > 1
  const valorSelecionadoCents = itensSelecionados.reduce((soma, i) => soma + i.valueCents, 0)

  /*
    A folga do fim da lista, quando a barra flutuante aparece.

    MEDIDO em 2026-09-09, a 390px: a `ActionBar` e `fixed` em
    `bottom: tabbar + 12px` e tem 70px de altura propria, entao o topo dela fica a 146px do fundo
    da tela. O `pb` do layout do admin reserva `tabbar + 28` = 92px. Sobram ~54px de lista
    passando POR BAIXO da barra, e a barra e quase opaca (`bg-surface/95` com desfoque).

    `ficha.tsx` ja tinha topado com isto e resolvido com `pb-20`, com o motivo escrito — mas so
    para ela. Aqui a barra e condicional (so com selecao), entao a folga tambem e: sem selecao
    nao ha barra e o espaco vazio seria desperdicio. Padding no FIM nao move o que esta acima,
    entao ligar a folga junto com a barra nao empurra a lista.
  */
  return (
    <div className={itensSelecionados.length > 0 ? 'pb-20' : undefined}>
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

      {/*
        `docs/82` §7, medido em 2026-09-23 numa conta nova: esta é a tela a que o primeiro passo leva
        ("Traga quem você já atende" → "Ver quem são"), e antes da lista vinham DOIS parágrafos de
        ressalva — o método e a lacuna de custo — empurrando os nomes para fora da primeira tela do
        celular. O método continua a um toque, com a frase que importa ("estimativa, não promessa")
        visível no resumo. A lacuna de custo continua SEMPRE visível (`tela-que-desconta-produto-
        sabe-a-lacuna`), só mais curta. E "cada uma… ela" virou "cada pessoa": numa barbearia a
        clientela não é "ela".
      */}
      <details className="mb-3 text-secundario text-txt-3">
        <summary className="cursor-pointer py-4 font-semibold text-txt-2">Estimativa, não promessa: como a conta é feita</summary>
        <p className="pb-2">
          O preço do serviço de cada pessoa, multiplicado pela chance de ela voltar. Quanto mais tempo sem aparecer, menor a
          chance, e por isso quem sumiu há mais tempo vale menos aqui. A ordem da lista segue o <strong>lucro</strong>, o que
          sobra depois da comissão{servicosSemMaterial > 0 ? '' : ' e do produto'}, não o preço.
        </p>
      </details>

      {servicosSemMaterial > 0 ? (
        <p className="mb-4 text-secundario text-txt-3">
          {servicosSemMaterial === 1 ? '1 serviço está' : `${servicosSemMaterial} serviços estão`} sem o custo do material, então a
          ordem da lista pode estar errada.{' '}
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
                      {item.serviceName} · {RUBRICA_ESTADO[item.state as Estado]} · {item.lateDays > 0 ? `${item.lateDays}d de atraso` : 'na janela'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {/*
                      `docs/DECISOES.md` 2026-09-18: assinante do clube e pacote com sessão sobrando
                      zeram os dois valores de propósito (a próxima visita não gera venda avulsa) —
                      e depois desse conserto, R$0,00 deixou de ser um caso raro. Sem esta ressalva,
                      "R$0,00 de lucro" ao lado de um botão "Avisar" lê como número quebrado, não
                      como informação — a mesma lição do "estado incompleto honesto" em
                      `prestacao.tsx`. Não afirma qual dos dois motivos é (assinante, pacote, ou uma
                      probabilidade calibrada genuinamente perto de zero): a tela não sabe qual, e
                      inventar um dos dois seria menos honesto que dizer "sem valor avulso".
                    */}
                    {item.valueCents === 0 && item.profitCents === 0 ? (
                      <p className="text-label text-txt-3">Sem valor avulso</p>
                    ) : (
                      <>
                        <p className="tabular text-corpo font-bold text-acc-2">{dinheiro.format(item.valueCents / 100)}</p>
                        <p className="tabular text-label text-txt-3">{dinheiro.format(item.profitCents / 100)} de lucro</p>
                      </>
                    )}
                    {/*
                      `docs/82` §7, medido em 2026-09-23: quem traz a base de memória ("Quem você já
                      atende") deixa o WhatsApp em branco — o campo é opcional de propósito. "Avisar"
                      nessa pessoa terminava em "sem telefone cadastrado", um beco sem saída no
                      primeiro contato com a lista. O contato dela já está no celular do dono, pelo
                      nome: `wa.me` sem número abre o seletor do próprio WhatsApp com o texto pronto.
                    */}
                    {item.phone ? (
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
                    ) : (
                      <a
                        href={linkWhatsAppCompartilhar(textoDeVolta({ nome: item.name, servico: item.serviceName }))}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Chamar ${item.name} pelo seu WhatsApp`}
                        onClick={() => void anotarChamada(item)}
                        className="toque-48 -mr-2 mt-0.5 inline-flex h-10 items-center px-2 text-label font-semibold text-acc-2 transition active:scale-[.97]"
                      >
                        Chamar
                      </a>
                    )}
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
            nativo={nativo}
            className="border-0 bg-transparent p-1 shadow-none"
            precisaDo="essencial"
            acao="avisar todo mundo de uma vez"
            evidencia={{
              quantidade: itensSelecionados.length,
              substantivo: 'na lista, esperando para voltar',
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
  // `canalDeContato` devolve `null` quando nao ha WhatsApp nem e-mail configurado. E o que
  // decide se a frase pode mandar falar com a gente ou tem que calar.
  const v = vazioDeRecuperar(temClientes, temCiclos, temAtendimentosConcluidos, canalDeContato(ASSUNTO_MOTOR_PARADO) !== null)
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
