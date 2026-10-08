'use client'

import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { useVocabulario } from '@/components/shell/vocabulario'
import { comMaiuscula, plural } from '@/core/text/vocabulario'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import { ASSUNTO_MOTOR_PARADO, canalDeContato } from '@/lib/contato'
import { linkWhatsApp, linkWhatsAppCompartilhar, primeiroNome, textoDeVolta } from '@/lib/mensagens'
import FilterRow from '@/components/ui/filter-row'
import IconeAnel from '@/components/ui/icone-anel'
import IconeWhatsApp from '@/components/ui/icone-whatsapp'
import Skeleton from '@/components/ui/skeleton'
import StatTile from '@/components/ui/stat-tile'
import { useToast } from '@/components/ui/toast'
import { dinheiro } from '@/lib/formato'
import { cn } from '@/lib/utils'

import { recorteDaLista } from '@/core/ciclo/recorte-da-lista'
import { CRITERIOS, ROTULO_DO_CRITERIO, filtrarFila, ordenarFila, type Criterio } from '@/core/ciclo/fila-de-chamadas'
import { ROTULO_DA_CLASSE, ROTULO_DO_PERFIL, type Classe, type Perfil } from '@/core/crm/nota-do-cliente'
import { vazioDeRecuperar } from '@/core/ciclo/vazio-de-recuperar'

import type { ItemRecuperar, ListaRecuperar } from '@/server/services/recuperar-receita'

import FilaDeChamadas from './fila'

type Estado = 'due' | 'late' | 'at_risk' | 'lost'

const FILTROS: { valor: Estado | 'all'; rotulo: string }[] = [
  { valor: 'all', rotulo: 'Todas' },
  { valor: 'due', rotulo: 'Na hora de voltar' },
  { valor: 'late', rotulo: 'Atrasadas' },
  { valor: 'at_risk', rotulo: 'Em risco' },
  { valor: 'lost', rotulo: 'Perdidas' },
]

function chave(item: Pick<ItemRecuperar, 'clientId' | 'serviceId'>): string {
  return `${item.clientId}:${item.serviceId}`
}

export default function RecuperarReceita({
  inicial,
  temClientes,
  temCiclos,
  temAtendimentosConcluidos,
  quandoOProximoVolta,
  servicosSemMaterial,
}: {
  inicial: ListaRecuperar
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
  /** O Motor já calculou algum ciclo — precisa de uma última visita (atendimento concluído ou informada), não só de ficha. */
  temCiclos: boolean
  /** Separa "ainda nao atendeu ninguem" de "atendeu e o Motor nao processou". */
  temAtendimentosConcluidos: boolean
  /** "daqui a 6 dias (29/09)" — só para o vazio de "todo mundo em dia"; `null` quando não há. */
  quandoOProximoVolta: string | null
}) {
  const vocabulario = useVocabulario()
  const mostrarToast = useToast()
  const [filtro, setFiltro] = useState<Estado | 'all'>('all')
  const [lista, setLista] = useState(inicial)
  const [carregando, setCarregando] = useState(false)
  // `docs/95` E2: a ordem e o recorte da fila valem para a lista e para o modo "um por vez".
  const [criterio, setCriterio] = useState<Criterio>('prioridade')
  const [classes, setClasses] = useState<Classe[]>([])
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [modoFila, setModoFila] = useState(false)

  async function trocarFiltro(valor: Estado | 'all') {
    setFiltro(valor)
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

  /*
    `docs/82` §7: o toque em "Chamar" abre o WhatsApp do dono numa aba nova e, em paralelo, anota a
    chamada — é o que faz a volta dessa pessoa contar em "O Motor de Ciclo trouxe". Falha aqui não
    pode travar a conversa que já abriu: vira aviso, e o dono segue no WhatsApp.
  */
  /*
    `docs/95` E2.4: "Pediu para não ser chamado", da fila. Grava o opt-out do WhatsApp (mesma coluna que
    o "Chamar" já respeita) e tira a pessoa da lista na hora. Falha vira aviso, e a pessoa continua
    na fila: melhor pedir de novo do que sumir sem ter gravado.
  */
  async function pararDeChamar(item: ItemRecuperar): Promise<boolean> {
    try {
      const r = await fetch(`/api/v1/clients/${item.clientId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ whatsappOptOut: true }),
      })
      if (!r.ok) throw new Error(String(r.status))
      setLista((atual) => ({ ...atual, items: atual.items.map((i) => (i.clientId === item.clientId ? { ...i, optOut: true } : i)) }))
      mostrarToast({ tom: 'ok', titulo: 'Anotado', descricao: `${primeiroNome(item.name)} não aparece mais para chamar.` })
      return true
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui gravar', descricao: 'Tente de novo. A pessoa continua na fila até gravar.' })
      return false
    }
  }

  async function anotarChamada(item: ItemRecuperar) {
    try {
      const r = await fetch('/api/v1/cycle/recover/manual', {
        method: 'POST',
        keepalive: true,
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ clientId: item.clientId, serviceId: item.serviceId }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const json = (await r.json()) as { data?: { registrada: boolean; motivo?: string } }
      const primeiro = primeiroNome(item.name)
      if (json.data?.registrada) {
        mostrarToast({ tom: 'ok', titulo: 'Anotado', descricao: `Se ${primeiro} marcar, a volta conta para o Motor de Ciclo.` })
      } else if (json.data?.motivo === 'ja_chamada') {
        // A conversa abriu do mesmo jeito; o que não acontece é contar duas vezes na mesma semana.
        mostrarToast({ tom: 'aviso', titulo: 'Já anotado nesta semana', descricao: `A chamada anterior de ${primeiro} continua valendo para o Motor.` })
      }
    } catch {
      mostrarToast({ tom: 'erro', titulo: 'Não consegui anotar a chamada', descricao: 'A mensagem no WhatsApp não muda. Só esta volta pode não aparecer no que o Motor trouxe.' })
    }
  }

  const recorte = recorteDaLista(lista.count, lista.items.length)
  const visiveis = ordenarFila(filtrarFila(lista.items, { classes, perfis }), criterio)
  const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor])

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
        <StatTile rotulo="Dá para recuperar" valor={dinheiro.format(lista.totalValueCents / 100)} apoio="estimativa" />
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
        <summary className="cursor-pointer py-3 font-semibold text-txt-2">Como a conta é feita</summary>
        <p className="pb-2">
          O preço do serviço de cada pessoa, multiplicado pela chance de ela voltar: é uma estimativa, não uma promessa. A ordem da
          lista segue o <strong>lucro</strong>, o que sobra depois da comissão{servicosSemMaterial > 0 ? '' : ' e do produto'}, não o
          preço.
        </p>
        {servicosSemMaterial > 0 ? (
          <p className="pb-2">
            {servicosSemMaterial === 1 ? '1 serviço está' : `${servicosSemMaterial} serviços estão`} sem o custo do material, então a
            ordem da lista pode estar errada.{' '}
            <Link href="/admin/config/servicos" className="toque-48 whitespace-nowrap font-semibold text-acc-2">
              Completar o custo
            </Link>
          </p>
        ) : null}
      </details>

      <FilterRow rotulo="Filtrar por estado do ciclo" className="mb-4">
        {FILTROS.map((f) => (
          <Chip key={f.valor} ligado={filtro === f.valor} onClick={() => trocarFiltro(f.valor)}>
            {f.rotulo}
          </Chip>
        ))}
      </FilterRow>

      {/*
        `docs/95` E2: a ordem e o recorte por classe e perfil continuam existindo, mas fechados: a
        primeira tela é só o estado do ciclo e o botão de começar. Quem precisa de mais abre aqui.
        Nada aqui manda mensagem: a ordem só decide por onde o dono começa.
      */}
      <details className="mb-4 text-secundario text-txt-2">
        <summary className="cursor-pointer py-2 font-semibold">Mais filtros</summary>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-secundario text-txt-2">
            Ordenar por
            <select
              value={criterio}
              onChange={(e) => setCriterio(e.target.value as Criterio)}
              className="h-12 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-3 text-corpo text-txt"
            >
              {CRITERIOS.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_DO_CRITERIO[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FilterRow rotulo="Filtrar por classe do cliente" className="mb-3">
          {(['ouro', 'prata', 'bronze'] as const).map((c) => (
            <Chip key={c} ligado={classes.includes(c)} onClick={() => setClasses((atual) => alternar(atual, c))}>
              {ROTULO_DA_CLASSE[c]}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow rotulo="Filtrar por perfil do cliente">
          {(['fiel', 'regular', 'novo', 'atrasado', 'faltante', 'sumido'] as const).map((p) => (
            <Chip key={p} ligado={perfis.includes(p)} onClick={() => setPerfis((atual) => alternar(atual, p))}>
              {ROTULO_DO_PERFIL[p]}
            </Chip>
          ))}
        </FilterRow>
      </details>

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
            quandoOProximoVolta={quandoOProximoVolta}
          />
        </Card>
      ) : modoFila ? (
        <FilaDeChamadas itens={visiveis} anotarChamada={anotarChamada} pararDeChamar={pararDeChamar} sair={() => setModoFila(false)} />
      ) : visiveis.length === 0 ? (
        <Card>
          <p className="text-corpo font-semibold">Ninguém com esse recorte.</p>
          <button
            type="button"
            onClick={() => {
              setClasses([])
              setPerfis([])
            }}
            className="toque-48 mt-2 h-10 text-label font-semibold text-acc-2"
          >
            Tirar os filtros
          </button>
        </Card>
      ) : (
        <>
          <Button largura="cheia" className="mb-3" onClick={() => setModoFila(true)}>
            {`Começar a fila (${visiveis.filter((i) => !i.optOut).length})`}
          </Button>
          <ul className="flex flex-col gap-2">
            {visiveis.map((item) => {
              const k = chave(item)
              return (
                <li key={k}>
                  <Card className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-corpo font-semibold">{item.name}</p>
                      <p className="truncate text-secundario text-txt-2">
                        {item.serviceName} · {item.lateDays > 0 ? `${item.lateDays}d de atraso` : 'na janela'}
                      </p>
                    </div>
                    {/*
                      O número da linha é o PREÇO do serviço da última visita, não a estimativa: a
                      estimativa (preço × chance de voltar) dava R$ 24,50 num corte de R$ 70 e o dono
                      lia "valor baixo". Assinante do clube e pacote com sessão sobrando zeram a estimativa
                      de propósito (a próxima visita não gera venda avulsa, `docs/DECISOES.md` 2026-09-18),
                      e nesse caso a linha diz "Sem valor avulso" em vez de um preço que não vira venda.
                    */}
                    <p className="tabular shrink-0 text-corpo font-bold text-acc-2">
                      {item.valueCents === 0 && item.profitCents === 0 ? (
                        <span className="text-label font-normal text-txt-3">Sem valor avulso</span>
                      ) : (
                        dinheiro.format(item.priceCents / 100)
                      )}
                    </p>
                    {/*
                      `docs/82` §7/§11 — decisão de 2026-09-23: "Chamar" é o WhatsApp DO PRÓPRIO DONO,
                      grátis, sem depender de credencial. Opt-out bloqueia o botão (o servidor também
                      recusa, `registrarChamadaManual`): mostrar o botão seria prometer um toque que
                      não faz nada. Com telefone válido o wa.me abre endereçado à pessoa; sem telefone
                      cai no seletor de contato do WhatsApp do dono (`linkWhatsAppCompartilhar`).
                    */}
                    {item.optOut ? (
                      <p className="w-14 shrink-0 text-center text-label text-txt-3">Pediu para não receber</p>
                    ) : (
                      <a
                        href={
                          linkWhatsApp(item.phone, textoDeVolta({ nome: item.name, servico: item.serviceName, link: item.linkVolta })) ??
                          linkWhatsAppCompartilhar(textoDeVolta({ nome: item.name, servico: item.serviceName, link: item.linkVolta }))
                        }
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Chamar ${item.name} pelo seu WhatsApp`}
                        onClick={() => void anotarChamada(item)}
                        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-acc text-on-acc shadow-elevado transition active:scale-[.94]"
                      >
                        <IconeWhatsApp className="size-6" />
                      </a>
                    )}
                  </Card>
              </li>
            )
          })}
        </ul>
        </>
      )}

    </div>
  )
}

/** So a marcacao: qual frase mostrar e decisao pura em `core/ciclo/vazio-de-recuperar.ts`. */
function EmptyStateDeRecuperar({
  temClientes,
  temCiclos,
  temAtendimentosConcluidos,
  quandoOProximoVolta,
}: {
  temClientes: boolean
  temCiclos: boolean
  temAtendimentosConcluidos: boolean
  quandoOProximoVolta: string | null
}) {
  // `canalDeContato` devolve `null` quando nao ha WhatsApp nem e-mail configurado. E o que
  // decide se a frase pode mandar falar com a gente ou tem que calar.
  const v = vazioDeRecuperar(
    temClientes,
    temCiclos,
    temAtendimentosConcluidos,
    canalDeContato(ASSUNTO_MOTOR_PARADO) !== null,
    quandoOProximoVolta,
  )
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
