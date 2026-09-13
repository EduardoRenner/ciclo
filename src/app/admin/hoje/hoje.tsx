'use client'

import Link from 'next/link'

import { TriangleAlert, CalendarCheck, ChevronRight, Gift, MessageCircle, PackageX } from 'lucide-react'
import { useState } from 'react'

import AppointmentRow from '@/components/ui/appointment-row'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'
import { useAtualizarDepois } from '@/lib/atualizar-depois'
import { dinheiro } from '@/lib/formato'
import { aplicarVariaveis, linkWhatsApp } from '@/lib/mensagens'

import DetalheAgendamento from '../agenda/detalhe'
import CompartilharSite from './compartilhar'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { LinhaAgendaDia } from '@/server/services/agendamentos'
import type { ReceitaAtribuida } from '@/server/services/atribuicao'
import type { LinhaHoje, ResumoHoje } from '@/server/services/resumo-hoje'

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * docs/62 Fase B: frase sem citar o dia da semana por nome — o dado vem calculado no servidor
 * (fuso do tenant), e nomear "domingo" aqui exigiria ou mandar o nome do servidor (mais um campo
 * só pra isso) ou calcular de novo no cliente arriscando um fuso diferente do que gerou o número.
 * "Nesse dia da semana" é o mesmo fato, sem esse risco.
 */
function textoDaComparacao(percentual: number): string {
  if (percentual === 0) return 'Igual ao costume nesse dia da semana'
  const abs = Math.abs(percentual)
  return `${abs}% ${percentual > 0 ? 'acima' : 'abaixo'} do costume nesse dia da semana`
}

/**
 * docs/62 Fase A: texto pronto, não campo livre — mesmo padrão de `mensagens-prontas.ts`.
 * `null` sem telefone cadastrado: nunca inventa contato, o ícone some (ver ponto de uso).
 */
export function linkWhatsAppDoProximo(agendamento: LinhaHoje): string | null {
  const texto = aplicarVariaveis('Oi {{nome}}! Tudo certo pro seu horário hoje às {{hora}}?', {
    nome: agendamento.clients?.name ?? null,
    hora: horaLocal(agendamento.starts_at),
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

export type HeroiDaHome = 'motor_trouxe' | 'motor_em_risco' | 'atendido'

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
  atribuicaoCount: number
  valorEmRiscoCents: number
}): HeroiDaHome {
  if (entrada.atendidoHojeCents > 0) return 'atendido'
  if (entrada.atribuicaoCount > 0) return 'motor_trouxe'
  if (entrada.valorEmRiscoCents > 0) return 'motor_em_risco'
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
  children,
}: {
  resumo: ResumoHoje
  atribuicao: ReceitaAtribuida
  /** Total e contagem de `listarParaRecuperar` — a MESMA fonte de `/admin/recuperar`. */
  emRisco: { totalCents: number; count: number }
  /** docs/62 Fase A2: `null` só quando o tenant ainda não tem slug (não deveria acontecer em /admin, mas o tipo permite). */
  site: { slug: string; nome: string } | null
  children?: React.ReactNode
}) {
  const atualizarDepois = useAtualizarDepois()
  const [selecionado, setSelecionado] = useState<LinhaHoje | null>(null)

  const faltam = resumo.restOfDay.length
  const heroi = escolherHeroi({
    atendidoHojeCents: resumo.revenueTodayCents,
    atribuicaoCount: atribuicao.count,
    valorEmRiscoCents: emRisco.totalCents,
  })
  const destinoDoHeroi = heroi === 'atendido' ? '/admin/caixa' : '/admin/recuperar'

  /*
   * As três seções desta tela mostram fatias da MESMA lista, e antes disto elas se sobrepunham:
   * um único agendamento pendente das 16:00 aparecia em "A seguir", em "Precisa confirmar" e de
   * novo em "Resto do dia" — três cartões idênticos, que se leem como três clientes no mesmo
   * horário. Aqui cada agendamento cai em exatamente uma seção, na ordem de prioridade da tela.
   *
   * `resumo.restOfDay` continua sendo o dia inteiro que ainda vem, de propósito: é dele que saem
   * o contador "falta N atendimento hoje" aqui em cima e a resposta do assistente sobre
   * pendentes. Quem precisa da fatia é só o desenho, então a fatia se faz aqui.
   *
   * "A seguir" ganha a prioridade porque é a pergunta que a tela existe para responder. O próximo
   * cliente que também precisa de confirmação não perde o aviso: o próprio cartão carrega o
   * rótulo "Aguardando" em cor de alerta.
   */
  const idProximo = resumo.nextClient?.id
  const alertasSemOProximo = resumo.alerts.filter((a) => a.id !== idProximo)
  const jaMostrados = new Set([idProximo, ...alertasSemOProximo.map((a) => a.id)].filter(Boolean))
  const restanteNaoMostrado = resumo.restOfDay.filter((a) => !jaMostrados.has(a.id))

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
        A única métrica de dinheiro da tela principal ocupava um cartão do
        mesmo tamanho de um contador qualquer. Vira herói: `--text-numero`, o
        maior tamanho da escala, que estava definido desde o primeiro dia e não
        era usado em lugar nenhum do app.
      */}
      {/*
        O número de dinheiro da tela principal era um beco: mostrava o total do
        dia e não levava a lugar nenhum. A pergunta seguinte ("de onde veio, e
        quanto sobrou?") tem tela desde esta rodada — tocar no número é o gesto
        natural para chegar nela.
      */}
      <Link href={destinoDoHeroi} className="mb-6 block">
        {heroi === 'motor_trouxe' ? (
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
        ) : heroi === 'motor_em_risco' ? (
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
                {`${emRisco.count} ${emRisco.count === 1 ? 'cliente passou da hora de voltar' : 'clientes passaram da hora de voltar'}`}
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
            rotulo={ROTULO_DO_ATENDIDO}
            valor={dinheiro.format(resumo.revenueTodayCents / 100)}
            apoio={
              <span className="flex flex-col gap-0.5">
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

      {resumo.nextClient ? (
        <section className="mb-6">
          <SectionHeader>A seguir</SectionHeader>
          {/*
            docs/62 Fase A: o toque mais comum do dia (chamar o próximo cliente) levava a
            três telas — card, sheet, achar o botão lá dentro. Vira um ícone ao lado, não
            empilhado no mesmo texto corrido: dois `toque-48` na mesma linha já se cobriram
            nesta base (CLAUDE.md), o `flex gap-2` com dois irmãos evita repetir.
          */}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => setSelecionado(resumo.nextClient)}
              className="block min-w-0 flex-1 text-left"
            >
              <AppointmentRow
                horario={horaLocal(resumo.nextClient.starts_at)}
                clienteNome={resumo.nextClient.clients?.name ?? 'Cliente'}
                servicoNome={resumo.nextClient.services?.name ?? 'Serviço'}
                status={resumo.nextClient.status as EstadoAgendamento}
                alertaSaude={resumo.nextClient.clients?.health_records?.some((h) => h.has_alert) ?? false}
              />
            </button>
            {linkWhatsAppDoProximo(resumo.nextClient) ? (
              <a
                href={linkWhatsAppDoProximo(resumo.nextClient)!}
                target="_blank"
                rel="noreferrer"
                aria-label={`Chamar ${resumo.nextClient.clients?.name ?? 'cliente'} no WhatsApp`}
                className="grid size-12 shrink-0 place-items-center self-center rounded-[var(--radius-pill)] border border-line-2 bg-surface-2 text-acc-2 transition hover:bg-surface-3 active:scale-[.94]"
              >
                <MessageCircle aria-hidden className="size-5" />
              </a>
            ) : null}
          </div>
        </section>
      ) : (
        <>
          {/*
            F1: sem próximo cliente, a Central de Ações vira o conteúdo principal da tela — o
            trabalho que o Motor achou — em vez de vir depois de um card vazio que qualquer
            pessoa em teste no dia 1 leria como "isto aqui não faz nada ainda".
          */}
          {children}
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
                    <Link href="/admin/agenda/novo">Novo agendamento</Link>
                    <CompartilharSite slug={site.slug} nome={site.nome} rotulo="Compartilhar meu link" />
                  </div>
                ) : (
                  <Link href="/admin/agenda/novo">Novo agendamento</Link>
                )
              }
            />
          </Card>
        </>
      )}

      {alertasSemOProximo.length > 0 ? (
        <section className="mb-6">
          <SectionHeader tom="alerta" icone={<TriangleAlert aria-hidden className="size-4" />}>
            Precisa confirmar
          </SectionHeader>
          <ul className="flex flex-col gap-2">
            {alertasSemOProximo.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setSelecionado(a)} className="block w-full text-left">
                  <AppointmentRow
                    horario={horaLocal(a.starts_at)}
                    clienteNome={a.clients?.name ?? 'Cliente'}
                    servicoNome={a.services?.name ?? 'Serviço'}
                    status={a.status as EstadoAgendamento}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Quando não há próximo cliente, a Central de Ações já foi renderizada acima. */}
      {resumo.nextClient ? children : null}

      {!temBloqueioDeEstoque ? secaoEstoque : null}

      {/*
        A seção some quando tudo que ainda vem já está desenhado acima. Mostrar "Resto do dia ·
        Sem mais nada agendado" logo abaixo de um cartão das 17:00 seria a tela se contradizendo:
        o vazio aqui só pode significar dia encerrado, e é isso que `restOfDay.length === 0` diz.
      */}
      {resumo.restOfDay.length === 0 || restanteNaoMostrado.length > 0 ? (
        <section>
          <SectionHeader>Resto do dia</SectionHeader>
          {resumo.restOfDay.length === 0 ? (
            <p className="text-secundario text-txt-2">Sem mais nada agendado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {restanteNaoMostrado.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setSelecionado(a)} className="block w-full text-left">
                    <AppointmentRow
                      horario={horaLocal(a.starts_at)}
                      clienteNome={a.clients?.name ?? 'Cliente'}
                      servicoNome={a.services?.name ?? 'Serviço'}
                      status={a.status as EstadoAgendamento}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <Sheet aberto={!!selecionado} aoFechar={(aberto) => !aberto && setSelecionado(null)} titulo="Agendamento">
        {selecionado ? (
          <DetalheAgendamento
            agendamento={selecionado as unknown as LinhaAgendaDia}
            onFechar={() => setSelecionado(null)}
            onAtualizado={() => {
              setSelecionado(null)
              atualizarDepois()
            }}
          />
        ) : null}
      </Sheet>
    </div>
  )
}
