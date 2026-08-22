'use client'

import Link from 'next/link'

import { TriangleAlert, CalendarCheck, ChevronRight, PackageX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import AppointmentRow from '@/components/ui/appointment-row'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import SectionHeader from '@/components/ui/section-header'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'

import DetalheAgendamento from '../agenda/detalhe'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { LinhaAgendaDia } from '@/server/services/agendamentos'
import type { LinhaHoje, ResumoHoje } from '@/server/services/resumo-hoje'

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * `children` é a "Central de ações", renderizada no servidor e encaixada aqui
 * entre o que está acontecendo agora e o resto do dia. Sem esse encaixe ela
 * teria que ficar antes do dinheiro (empurrando o número principal para baixo
 * da dobra) ou depois da lista inteira do dia, onde ninguém rola até.
 */
export default function Hoje({ resumo, children }: { resumo: ResumoHoje; children?: React.ReactNode }) {
  const router = useRouter()
  const [selecionado, setSelecionado] = useState<LinhaHoje | null>(null)

  const faltam = resumo.restOfDay.length

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
      <Link href="/admin/caixa" className="mb-6 block">
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
      </Link>

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
        <Card className="mb-6 p-0">
          <EmptyState
            icone={<CalendarCheck aria-hidden className="size-6" />}
            titulo="Nada mais para hoje"
            descricao="A agenda de hoje está livre a partir de agora."
            acao={<Link href="/admin/agenda/novo">Novo agendamento</Link>}
          />
        </Card>
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

      {children}

      {resumo.stockAlerts.length > 0 ? (
        <section className="mb-6">
          <SectionHeader tom="alerta" icone={<PackageX aria-hidden className="size-4" />}>
            Estoque
          </SectionHeader>
          <ul className="flex flex-col gap-2">
            {resumo.stockAlerts.map((a) => (
              <li key={a.productId}>
                <Card className="flex items-center justify-between gap-3">
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
                </Card>
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
              router.refresh()
            }}
          />
        ) : null}
      </Sheet>
    </div>
  )
}
