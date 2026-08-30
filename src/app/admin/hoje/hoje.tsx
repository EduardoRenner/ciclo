'use client'

import Link from 'next/link'

import { TriangleAlert, CalendarCheck, ChevronRight, Gift, PackageX } from 'lucide-react'
import { useState } from 'react'

import AppointmentRow from '@/components/ui/appointment-row'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'
import { useAtualizarDepois } from '@/lib/atualizar-depois'
import { dinheiro } from '@/lib/formato'

import DetalheAgendamento from '../agenda/detalhe'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { LinhaAgendaDia } from '@/server/services/agendamentos'
import type { ReceitaAtribuida } from '@/server/services/atribuicao'
import type { LinhaHoje, ResumoHoje } from '@/server/services/resumo-hoje'

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * F1 (`docs/25-ESTRATEGIA-E-EXECUCAO.md`): em dia sem movimento nenhum (nada faturado, nada
 * marcado pra frente), R$ 0,00 é a primeira coisa que a tela diz — pro profissional em teste, no
 * dia 1, isso lê como fracasso. Exportada pura (sem props do componente) para poder testar a
 * decisão sem montar React — este projeto não tem harness de render de componente.
 */
export function deveMostrarHeroiDoMotor(revenueTodayCents: number, temProximoCliente: boolean, atribuicaoCount: number): boolean {
  return revenueTodayCents === 0 && !temProximoCliente && atribuicaoCount > 0
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
  children,
}: {
  resumo: ResumoHoje
  atribuicao: ReceitaAtribuida
  children?: React.ReactNode
}) {
  const atualizarDepois = useAtualizarDepois()
  const [selecionado, setSelecionado] = useState<LinhaHoje | null>(null)

  const faltam = resumo.restOfDay.length
  const mostrarHeroiDoMotor = deveMostrarHeroiDoMotor(resumo.revenueTodayCents, !!resumo.nextClient, atribuicao.count)

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
      <Link href={mostrarHeroiDoMotor ? '/admin/recuperar' : '/admin/caixa'} className="mb-6 block">
        {mostrarHeroiDoMotor ? (
          <StatTile
            pressionavel
            heroi
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
        ) : (
          <StatTile
            pressionavel
            heroi
            rotulo="Faturado hoje"
            valor={dinheiro.format(resumo.revenueTodayCents / 100)}
            apoio={
              <span className="flex items-center justify-between gap-2">
                {faltam === 0
                  ? 'Nada mais marcado para hoje'
                  : `Faltam ${faltam} ${faltam === 1 ? 'atendimento' : 'atendimentos'} hoje`}
                <span className="flex shrink-0 items-center gap-0.5 font-semibold text-acc-2">
                  Ver o caixa
                  <ChevronRight aria-hidden className="size-4" />
                </span>
              </span>
            }
          />
        )}
      </Link>

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
              {resumo.indicacoesEsteMes} {resumo.indicacoesEsteMes === 1 ? 'cliente nova' : 'clientes novas'}
            </span>{' '}
            este mês. Quem vem por indicação costuma voltar mais.
          </p>
        </Card>
      ) : null}

      {resumo.nextClient ? (
        <section className="mb-6">
          <SectionHeader>A seguir</SectionHeader>
          <button type="button" onClick={() => setSelecionado(resumo.nextClient)} className="block w-full text-left">
            <AppointmentRow
              horario={horaLocal(resumo.nextClient.starts_at)}
              clienteNome={resumo.nextClient.clients?.name ?? 'Cliente'}
              servicoNome={resumo.nextClient.services?.name ?? 'Serviço'}
              status={resumo.nextClient.status as EstadoAgendamento}
              alertaSaude={resumo.nextClient.clients?.health_records?.some((h) => h.has_alert) ?? false}
            />
          </button>
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
              acao={<Link href="/admin/agenda/novo">Novo agendamento</Link>}
            />
          </Card>
        </>
      )}

      {resumo.alerts.length > 0 ? (
        <section className="mb-6">
          <SectionHeader tom="alerta" icone={<TriangleAlert aria-hidden className="size-4" />}>
            Precisa confirmar
          </SectionHeader>
          <ul className="flex flex-col gap-2">
            {resumo.alerts.map((a) => (
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

      {resumo.stockAlerts.length > 0 ? (
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
                          ? 'Vencido — uso bloqueado'
                          : a.validade === 'alerta'
                            ? 'Perto de vencer'
                            : a.precisaRecomprar
                              ? `${a.stockQty} em estoque — hora de recomprar`
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
      ) : null}

      <section>
        <SectionHeader>Resto do dia</SectionHeader>
        {resumo.restOfDay.length === 0 ? (
          <p className="text-secundario text-txt-2">Sem mais nada agendado.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resumo.restOfDay.map((a) => (
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
