'use client'

import Link from 'next/link'

import { CalendarCheck, ChevronRight, Gift, MessageCircle, PackageX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'

import AppointmentRow, { COR_ROTULO, ROTULO_ESTADO } from '@/components/ui/appointment-row'
import Button from '@/components/ui/button'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import StatTile from '@/components/ui/stat-tile'
import { useAtualizarDepois } from '@/lib/atualizar-depois'
import { useFuso } from '@/components/shell/fuso'
import { dinheiro, horaLocal } from '@/lib/formato'
import { aplicarVariaveis, linkWhatsApp, linkWhatsAppCompartilhar } from '@/lib/mensagens'
import { APP_URL } from '@/lib/app-url'
import { linkComOrigem } from '@/core/aquisicao/origem'
import { acoesDoHorario } from '@/core/scheduling/acoes-do-horario'
import { vibrarConfirmacao } from '@/lib/haptics'
import { textoDoConviteDoCiclo } from '@/core/billing/convite-do-ciclo'

import DetalheAgendamento, { post, ROTA_ACAO, ROTULO_ACAO, TITULO_FEITO } from '../agenda/detalhe'
import CompartilharSite from './compartilhar'
import BlocoFalhou from './bloco-falhou'
import PrestacaoTeaser from './prestacao-teaser'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { PrestacaoDeContas } from '@/core/cycle/prestacao-de-contas'
import type { LinhaAgendaDia } from '@/server/services/agendamentos'
import type { ReceitaAtribuida } from '@/server/services/atribuicao'
import type { LinhaHoje, ResumoHoje } from '@/server/services/resumo-hoje'


/**
 * docs/62 Fase B: frase sem citar o dia da semana por nome — o dado vem calculado no servidor
 * (fuso do tenant), e nomear "domingo" aqui exigiria ou mandar o nome do servidor (mais um campo
 * só pra isso) ou calcular de novo no cliente arriscando um fuso diferente do que gerou o número.
 * "Nesse dia da semana" é o mesmo fato, sem esse risco.
 */
function textoDaComparacao(percentual: number): string {
  // APR-034: a régua é o costume ATÉ ESTA HORA, não o dia inteiro — a frase diz isso.
  if (percentual === 0) return 'Igual ao costume até esta hora nesse dia da semana'
  const abs = Math.abs(percentual)
  return `${abs}% ${percentual > 0 ? 'acima' : 'abaixo'} do costume até esta hora nesse dia da semana`
}

/**
 * docs/62 Fase A: texto pronto, não campo livre — mesmo padrão de `mensagens-prontas.ts`.
 * `null` sem telefone cadastrado: nunca inventa contato, o ícone some (ver ponto de uso).
 */
export function linkWhatsAppDoProximo(agendamento: LinhaHoje, fuso: string): string | null {
  const texto = aplicarVariaveis('Oi {{nome}}! Tudo certo pro seu horário hoje às {{hora}}?', {
    nome: agendamento.clients?.name ?? null,
    hora: horaLocal(agendamento.starts_at, fuso),
  })
  return linkWhatsApp(agendamento.clients?.phone_e164 ?? null, texto)
}

/**
 * "Faturado hoje" era mentira por uma palavra, e ficou escrito aqui para não voltar.
 *
 * O número embaixo deste rótulo soma o `price_cents` DO AGENDAMENTO dos atendimentos concluídos —
 * preço de tabela. Ele não sabe de desconto dado na comanda, de item extra lançado, nem de
 * gorjeta. Num dia com desconto, "faturado" mostrava mais do que a pessoa recebeu.
 *
 * "Faturar" é o que entrou; isto é o que foi atendido. Quem tem o número do dinheiro é o caixa
 * (`caixa.ts`, rótulo "Entrou no dia", soma `tickets.total_cents` das comandas FECHADAS) — e o
 * link para ele já está na linha de apoio, logo abaixo do valor. Os dois números estão certos
 * para o que medem; o errado era um deles se chamar faturamento.
 */
const ROTULO_DO_ATENDIDO = 'Atendido hoje'

export type HeroiDaHome = 'motor_trouxe' | 'motor_em_risco' | 'atendido' | 'indisponivel'

/**
 * Qual número abre a tela — e por que "R$ 0,00" deixou de ser a resposta padrão.
 *
 * **Medido em 2026-09-10**, no painel local com dados de verdade, às 11h30: o maior elemento da
 * home era `R$ 0,00` a 34 px (o dobro de qualquer outra coisa), enquanto `R$ 302,75` de receita em
 * risco — o número que o Motor calcula e que nenhum concorrente tem — não aparecia em lugar
 * nenhum. Ele existe, bem apresentado, em `/admin/recuperar`, a um clique de distância.
 *
 * A regra anterior exigia TRÊS condições ao mesmo tempo (`receita === 0 && !temProximoCliente &&
 * atribuicao > 0`) e por isso quase nunca disparava: bastava ter um cliente marcado para as 13h
 * para a tela voltar a abrir com zero. E a atribuição só existe DEPOIS que o Motor já trouxe
 * alguém — ou seja, o reforço chegava para quem já estava convencido, e faltava justamente para
 * quem está decidindo se o produto vale.
 *
 * A ordem aqui é a da utilidade, não a do otimismo:
 *
 * 1. **Entrou dinheiro hoje** — o dia está acontecendo, e o número do dia ganha de qualquer outro.
 * 2. **O Motor já trouxe este mês** — prova consumada vence oportunidade; é o valor que o produto
 *    já entregou, com nome e sobrenome em `/admin/recuperar`.
 * 3. **Tem receita em risco agora** — a pergunta que só este produto responde: quanto sai pela
 *    porta se ninguém fizer nada.
 * 4. **Nada disso** — `R$ 0,00` com "Atendido hoje", porque aí não há número melhor e inventar um
 *    seria pior que mostrar zero.
 *
 * `temProximoCliente` saiu da conta de propósito: ter cliente às 13h não torna `R$ 0,00` uma
 * manchete melhor que `R$ 302,75`, e o próximo cliente já tem cartão próprio e destacado logo
 * abaixo ("A seguir"). O que ele fazia era anular o conserto no caso mais comum.
 */
export function escolherHeroi(entrada: {
  atendidoHojeCents: number
  /** APR-106: `null` = o bloco não carregou. Não é zero, e a manchete não pode fingir que é. */
  atribuicaoCount: number | null
  valorEmRiscoCents: number | null
}): HeroiDaHome {
  if (entrada.atendidoHojeCents > 0) return 'atendido'
  if (entrada.atribuicaoCount !== null && entrada.atribuicaoCount > 0) return 'motor_trouxe'
  if (entrada.valorEmRiscoCents !== null && entrada.valorEmRiscoCents > 0) return 'motor_em_risco'
  // Sem dinheiro hoje e sem saber do Motor: dizer "R$ 0,00" seria inventar um número.
  if (entrada.atribuicaoCount === null || entrada.valorEmRiscoCents === null) return 'indisponivel'
  return 'atendido'
}

/**
 * `children` é a "Central de ações", renderizada no servidor. Com próximo cliente marcado, fica
 * encaixada entre o que está acontecendo agora e o resto do dia — sem esse encaixe ela teria que
 * ficar antes do dinheiro (empurrando o número principal para baixo da dobra) ou depois da lista
 * inteira do dia, onde ninguém rola até. Sem próximo cliente (F1,
 * `docs/25-ESTRATEGIA-E-EXECUCAO.md`), sobe para antes do card de "nada pra hoje" — é o trabalho
 * que o Motor achou, e não deve ficar atrás de um card que só confirma que a agenda está vazia.
 */
export default function Hoje({
  resumo,
  atribuicao,
  emRisco,
  site,
  prestacaoDeContas,
  children,
}: {
  resumo: ResumoHoje
  /** APR-106: `null` quando o bloco não carregou; a tela avisa em vez de mostrar zero. */
  atribuicao: ReceitaAtribuida | null
  /** Total e contagem de `listarParaRecuperar` — a MESMA fonte de `/admin/recuperar`. */
  emRisco: { totalCents: number; count: number; naHoraDeVoltar: number } | null
  /** docs/62 Fase A2: `null` só quando o tenant ainda não tem slug (não deveria acontecer em /admin, mas o tipo permite). */
  site: { slug: string; nome: string } | null
  /** docs/45 §1.4: a manchete do único recurso que nenhum concorrente pesquisado tem. */
  prestacaoDeContas: PrestacaoDeContas | null
  children?: React.ReactNode
}) {
  const fuso = useFuso()
  const atualizarDepois = useAtualizarDepois()
  const [selecionado, setSelecionado] = useState<LinhaHoje | null>(null)
  /*
    APR-107 (docs/98 C-09): o estado do sheet era um `setState` comum. "Chegou" com a rede caída
    deixava o sheet no estado NOVO para sempre (sem Chegou, com Concluir), como se tivesse gravado.
    `useOptimistic`, como na Agenda: a mudança vive dentro da transição do `fetch`; se a mutação
    falha e `onAtualizado` não roda, o React descarta a projeção sozinho e o sheet volta ao real.
  */
  const [selecionadoNaTela, aplicarStatusOtimista] = useOptimistic(
    selecionado,
    (atual, status: EstadoAgendamento) => (atual ? { ...atual, status } : atual),
  )

  const faltam = resumo.restOfDay.length
  const heroi = escolherHeroi({
    atendidoHojeCents: resumo.numeroDoDia.cents,
    atribuicaoCount: atribuicao ? atribuicao.count : null,
    valorEmRiscoCents: emRisco ? emRisco.totalCents : null,
  })
  const destinoDoHeroi = heroi === 'atendido' ? '/admin/caixa' : '/admin/recuperar'

  /*
    APR-108 (docs/98 I-09): a ação do próximo horário em UM toque, aqui mesmo, sem abrir o sheet.
    `useOptimistic` + `router.refresh()` dentro da mesma transição: o estado novo aparece na hora e
    fica até o servidor confirmar; se a rota falhar, o React descarta e o botão volta (APR-107).
  */
  const router = useRouter()
  const mostrarToast = useToast()
  const proximo = resumo.nextClient
  const [statusDoProximo, aplicarStatusDoProximo] = useOptimistic(
    (proximo?.status ?? 'pending') as EstadoAgendamento,
    (_atual, novo: EstadoAgendamento) => novo,
  )
  const [agindo, iniciarAcao] = useTransition()
  const acaoDoProximo = proximo ? acoesDoHorario(statusDoProximo).principal : null
  function agirNoProximo(estado: EstadoAgendamento) {
    if (!proximo) return
    iniciarAcao(async () => {
      aplicarStatusDoProximo(estado)
      void vibrarConfirmacao()
      try {
        await post(`/api/v1/appointments/${proximo.id}/${ROTA_ACAO[estado]}`)
        mostrarToast({ tom: 'ok', titulo: TITULO_FEITO[estado] ?? 'Feito' })
        router.refresh()
      } catch (e) {
        mostrarToast({ tom: 'erro', titulo: 'Não consegui registrar', descricao: (e as Error).message })
      }
    })
  }
  const restante = resumo.restOfDay.filter((a) => a.id !== proximo?.id)
  const linkDoProximo = proximo ? linkWhatsAppDoProximo(proximo, fuso) : null

  /*
   * docs/62 Fase E4: a seção sempre vinha na mesma posição, não importa a gravidade — um
   * produto VENCIDO (uso bloqueado, o estado mais grave que `stockAlerts` conhece) ficava
   * espremido entre "Precisa confirmar" e "Resto do dia" do mesmo jeito que um aviso de
   * "perto de vencer"/"hora de recomprar". Critério objetivo (existe bloqueio ou não), não um
   * número de prioridade inventado.
   */
  const temBloqueioDeEstoque = resumo.stockAlerts.some((a) => a.validade === 'bloqueado')
  const secaoEstoque =
    resumo.stockAlerts.length > 0 ? (
      <section className="mb-6">
        <SectionHeader tom="alerta" icone={<PackageX aria-hidden className="size-4" />}>
          Estoque
        </SectionHeader>
        <ul className="flex flex-col gap-2">
          {/* Cada aviso era um cartão sem saída: dizia "hora de recomprar" e não levava a lugar nenhum. */}
          {resumo.stockAlerts.map((a) => (
            <li key={a.productId}>
              <Link href="/admin/estoque" className="block">
                <Card pressionavel className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-corpo font-semibold">{a.name}</p>
                    <p className="text-secundario text-txt-2">
                      {a.validade === 'bloqueado'
                        ? 'Vencido: uso bloqueado'
                        : a.validade === 'alerta'
                          ? 'Perto de vencer'
                          : a.precisaRecomprar
                            ? `${a.stockQty} em estoque, hora de recomprar`
                            : ''}
                    </p>
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-txt-3" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null

  return (
    <div>
      {/*
        APR-108 (docs/98 I-09, A-05): a ordem é a da pergunta "o que faço agora?". O próximo horário com
        a ação dele em um toque, o resto do dia logo abaixo, o número do dia, UM cartão de "vale a pena".
        Saíram do topo a saudação, o nome do negócio e "Ver meu site" (menu); saiu a faixa decorativa do
        dia (a lista é a informação) e saiu a seção "Precisa confirmar" (a linha já mostra "Aguardando").
        Medido antes: sem horário, "Marcar horário" nascia em y≈1080 no celular.
      */}
      {proximo ? (
        <section className="mb-6" data-agora>
          <SectionHeader>A seguir</SectionHeader>
          <Card>
            <button type="button" onClick={() => setSelecionado(proximo)} className="block w-full text-left">
              <p className="tabular text-stat font-semibold">{horaLocal(proximo.starts_at, fuso)}</p>
              <p className="text-corpo font-semibold">{proximo.clients?.name ?? 'Cliente'}</p>
              <p className="text-secundario text-txt-2">
                {proximo.services?.name ?? 'Serviço'} ·{' '}
                <span className={`font-semibold ${COR_ROTULO[statusDoProximo]}`}>{ROTULO_ESTADO[statusDoProximo]}</span>
              </p>
            </button>
            {acaoDoProximo || linkDoProximo ? (
              <div className="mt-3 flex gap-2">
                {acaoDoProximo ? (
                  <Button className="flex-1" carregando={agindo} onClick={() => agirNoProximo(acaoDoProximo)}>
                    {ROTULO_ACAO[acaoDoProximo]}
                  </Button>
                ) : null}
                {linkDoProximo ? (
                  <a
                    href={linkDoProximo}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-txt transition hover:bg-surface-3 active:scale-[.98]"
                  >
                    <MessageCircle aria-hidden className="size-5 text-acc-2" />
                    Mensagem
                  </a>
                ) : null}
              </div>
            ) : null}
          </Card>
        </section>
      ) : null}

      {proximo ? (
        restante.length > 0 ? (
          <section className="mb-6">
            <SectionHeader>
              Resto do dia · {restante.length} {restante.length === 1 ? 'horário' : 'horários'}
            </SectionHeader>
            <ul className="flex flex-col gap-2">
              {restante.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setSelecionado(a)} className="block w-full text-left">
                    <AppointmentRow
                      horario={horaLocal(a.starts_at, fuso)}
                      clienteNome={a.clients?.name ?? 'Cliente'}
                      servicoNome={a.services?.name ?? 'Serviço'}
                      status={a.status as EstadoAgendamento}
                      alertaSaude={a.clients?.health_records?.some((h) => h.has_alert) ?? false}
                    />
                  </button>
                </li>
              ))}
            </ul>
          <Link
            href="/admin/agenda/novo"
            className="mt-3 flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.98]"
          >
            Marcar horário
          </Link>
          </section>
        ) : (
          <div className="mb-6">
          <Link
            href="/admin/agenda/novo"
            className="flex h-12 w-full items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 text-corpo font-semibold text-txt transition duration-[var(--dur-1)] hover:bg-surface-3 active:scale-[.98]"
          >
            Marcar horário
          </Link>
          </div>
        )
      ) : (
        <>
      <Card className="mb-6 p-0">
        <EmptyState
          icone={<CalendarCheck aria-hidden className="size-6" />}
          titulo="Nada mais para hoje"
          descricao="A agenda de hoje está livre a partir de agora."
          acao={
            /*
              docs/62 Fase A2: "Novo agendamento" resolve quem já tem cliente pra marcar — pra
              quem não tem NENHUM hoje (nem concluído, nem cancelado), a saída mais útil é
              levar gente nova pra agenda, não abrir um formulário vazio. `totalAgendamentosHoje`
              distingue "dia que já rodou e acabou" de "dia que nunca teve nada".
            */
            resumo.totalAgendamentosHoje === 0 && site ? (
              <div className="flex flex-col items-center gap-2">
                <Link href="/admin/agenda/novo">Marcar horário</Link>
                <CompartilharSite slug={site.slug} nome={site.nome} rotulo="Compartilhar meu link" />
              </div>
            ) : (
              <Link href="/admin/agenda/novo">Marcar horário</Link>
            )
          }
        />
      </Card>
        </>
      )}

      {heroi === 'indisponivel' ? (
        <BlocoFalhou oQue="o número de hoje" className="mb-6" />
      ) : (
      <Link href={destinoDoHeroi} className="mb-6 block">
        {heroi === 'motor_trouxe' && atribuicao ? (
          <StatTile
            pressionavel
            heroi
            // docs/62 Fase E3: é a única manchete que comemora um fato JÁ acontecido (dinheiro que
            // voltou por causa do produto) em vez de um estado neutro — o mesmo cinza dos outros
            // heróis apagava a diferença. Tom sutil de `--ok`, não confete: é celebrar dado real
            // (docs/61 §5.7), não gamificação.
            className="border-ok/30 bg-ok/5"
            rotulo="O Motor de Ciclo trouxe este mês"
            valor={dinheiro.format(atribuicao.totalCents / 100)}
            apoio={
              <span className="flex items-center justify-between gap-2">
                {`${atribuicao.count} ${atribuicao.count === 1 ? 'agendamento recuperado' : 'agendamentos recuperados'}`}
                <span className="flex shrink-0 items-center gap-0.5 font-semibold text-acc-2">
                  Ver quem voltou
                  <ChevronRight aria-hidden className="size-4" />
                </span>
              </span>
            }
          />
        ) : heroi === 'motor_em_risco' && emRisco ? (
          /*
            "Dá para recuperar" e não "em risco": o rótulo diz o que a pessoa PODE fazer, não o que
            ela está perdendo. É a mesma palavra que `/admin/recuperar` usa no topo — a manchete e o
            destino têm que falar igual, senão o toque parece levar a outro assunto. E o valor sai
            da MESMA função que aquela tela (`listarParaRecuperar`), para os dois números nunca
            divergirem.
          */
          <StatTile
            pressionavel
            heroi
            rotulo="Dá para recuperar"
            valor={dinheiro.format(emRisco.totalCents / 100)}
            apoio={
              <span className="flex items-center justify-between gap-2">
                {`${emRisco.count} ${emRisco.count === 1 ? 'cliente para chamar de volta' : 'clientes para chamar de volta'}`}
                {emRisco.naHoraDeVoltar > 0 ? ` · ${emRisco.naHoraDeVoltar} na hora de voltar` : ''}
                <span className="flex shrink-0 items-center gap-0.5 font-semibold text-acc-2">
                  Ver quem sumiu
                  <ChevronRight aria-hidden className="size-4" />
                </span>
              </span>
            }
          />
        ) : (
          <StatTile
            pressionavel
            heroi
            rotulo={resumo.numeroDoDia.rotulo === 'Entrou hoje' ? 'Entrou hoje' : ROTULO_DO_ATENDIDO}
            valor={dinheiro.format(resumo.numeroDoDia.cents / 100)}
            apoio={
              <span className="flex flex-col gap-0.5">
                {resumo.horariosDoDia > 0 ? (
                  <span className="text-txt-2">
                    {resumo.horariosFeitos} de {resumo.horariosDoDia} {resumo.horariosDoDia === 1 ? 'horário feito' : 'horários feitos'}
                  </span>
                ) : null}
                {/*
                  docs/62 Fase B: "R$ 240 hoje é bom ou ruim?" não tinha resposta. Compara com a
                  MÉDIA do mesmo dia da semana — nunca com julgamento de cor (verde "bateu meta" /
                  vermelho "não bateu"): é informativo, não pressão (docs/61 §5.7).
                */}
                {resumo.comparacaoComCostume ? (
                  <span className="text-txt-2">{textoDaComparacao(resumo.comparacaoComCostume.percentual)}</span>
                ) : null}
                <span className="flex items-center justify-between gap-2">
                  {/* O verbo concorda junto com o substantivo: era "Faltam 1 atendimento hoje". */}
                  {faltam === 0
                    ? 'Nada mais marcado para hoje'
                    : faltam === 1
                      ? 'Falta 1 atendimento hoje'
                      : `Faltam ${faltam} atendimentos hoje`}
                  <span className="flex shrink-0 items-center gap-0.5 font-semibold text-acc-2">
                    Ver o caixa
                    <ChevronRight aria-hidden className="size-4" />
                  </span>
                </span>
              </span>
            }
          />
        )}
      </Link>
      )}

      {/*
        `docs/82` §11: o convite de colega morava só em "Meu plano", e lá ele fica — mas o momento em
        que alguém indica é o momento em que acabou de ganhar. Aparece SÓ com o herói "o Motor
        trouxe" este mês: aí não disputa espaço com a tarefa do dia, é a própria prova que o convite cita. Uma
        linha, sem prêmio (não há como pagar um — `convite-do-ciclo.ts`), e o link já leva quem
        indicou (`?origem=convite&ref=`), para a indicação aparecer no placar.
      */}
      {/* Pela ATRIBUIÇÃO, não pelo herói: em dia com receita o herói é "Atendido hoje" (revisão 2026-09-23). */}
      {atribuicao && atribuicao.count > 0 && site ? (
        <p className="-mt-3 mb-6 text-secundario text-txt-2">
          Conhece alguém do ramo que também perde cliente sem saber?{' '}
          <a
            href={linkWhatsAppCompartilhar(
              textoDoConviteDoCiclo({ nomeDoNegocio: site.nome, url: linkComOrigem(APP_URL, 'convite', site.slug) }),
            )}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-acc-2 underline underline-offset-2"
          >
            Mandar o CICLO
          </a>
        </p>
      ) : null}

      {temBloqueioDeEstoque ? secaoEstoque : null}

      {/*
        I-7, `docs/30-INDICACAO-PLANO.md` §5.3/§6.2d: o extrato do laço. Segue o padrão do
        `hoje-heroi-do-motor` — entra ABAIXO do herói, nunca disputa o lugar dele. Só aparece
        quando houve indicação no mês: número sem contexto é anedota, e mês sem indicação
        nenhuma não tem o que "trouxeram" mostrar.
      */}
      {resumo.indicacoesEsteMes > 0 ? (
        <Card className="mb-6 flex items-start gap-3">
          <Gift aria-hidden className="mt-0.5 size-5 shrink-0 text-acc-2" />
          <p className="text-corpo text-txt">
            Suas clientes trouxeram{' '}
            <span className="font-semibold">
              {resumo.indicacoesEsteMes} {resumo.indicacoesEsteMes === 1 ? 'pessoa nova' : 'pessoas novas'}
            </span>{' '}
            este mês. Quem vem por indicação costuma voltar mais.
          </p>
        </Card>
      ) : null}

      {children}

      {!temBloqueioDeEstoque ? secaoEstoque : null}

      {prestacaoDeContas ? <PrestacaoTeaser contas={prestacaoDeContas} /> : <BlocoFalhou oQue="a prestação de contas do Motor" className="mb-5" />}

      <Sheet aberto={!!selecionado} aoFechar={(aberto) => !aberto && setSelecionado(null)} titulo="Agendamento">
        {selecionadoNaTela ? (
          <DetalheAgendamento
            agendamento={selecionadoNaTela as unknown as LinhaAgendaDia}
            onFechar={() => setSelecionado(null)}
            onAtualizado={() => {
              setSelecionado(null)
              atualizarDepois()
            }}
            /*
              docs/53 H-00, escopo menor que em `agenda.tsx`: aqui "Hoje" fatia `resumo.restOfDay`
              em três seções (a seguir, alertas, resto do dia) sem uma lista única — otimizar as TRÊS
              juntas é trabalho maior que este ticket cobre. O sheet em si já fica otimista (os
              botões trocam na hora); as linhas por trás dele continuam esperando `atualizarDepois()`,
              como sempre esperaram.
            */
            aoMudarOtimista={aplicarStatusOtimista}
          />
        ) : null}
      </Sheet>
    </div>
  )
}
