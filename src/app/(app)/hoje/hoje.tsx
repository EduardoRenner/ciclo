'use client'

import Link from 'next/link'

import { AlertTriangle, CalendarCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import AppointmentRow from '@/components/ui/appointment-row'
import Card from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'

import DetalheAgendamento from '../agenda/detalhe'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { LinhaAgendaDia } from '@/server/services/agendamentos'
import type { LinhaHoje, ResumoHoje } from '@/server/services/resumo-hoje'

const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Hoje({ resumo }: { resumo: ResumoHoje }) {
  const router = useRouter()
  const [selecionado, setSelecionado] = useState<LinhaHoje | null>(null)

  return (
    <div>
      <div className="mb-6 grid grid-cols-1 gap-3">
        <StatTile rotulo="Faturado hoje" valor={dinheiro.format(resumo.revenueTodayCents / 100)} />
      </div>

      {resumo.nextClient ? (
        <section className="mb-6">
          <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Próxima cliente</h2>
          <button type="button" onClick={() => setSelecionado(resumo.nextClient)} className="block w-full text-left">
            <AppointmentRow
              horario={horaLocal(resumo.nextClient.starts_at)}
              clienteNome={resumo.nextClient.clients?.name ?? 'Cliente'}
              servicoNome={resumo.nextClient.services?.name ?? 'Serviço'}
              status={resumo.nextClient.status as EstadoAgendamento}
            />
          </button>
        </section>
      ) : (
        <Card className="mb-6 p-0">
          <EmptyState
            icone={<CalendarCheck aria-hidden className="size-6" />}
            titulo="Nada mais para hoje"
            descricao="A agenda de hoje está livre a partir de agora."
            acao={<Link href="/agenda/novo">Novo agendamento</Link>}
          />
        </Card>
      )}

      {resumo.alerts.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-overline font-semibold uppercase tracking-[0.13em] text-warn">
            <AlertTriangle aria-hidden className="size-3.5" />
            Precisa confirmar
          </h2>
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

      <section>
        <h2 className="mb-3 text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">Resto do dia</h2>
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
