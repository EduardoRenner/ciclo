'use client'

import Link from 'next/link'

import { CalendarX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import AppointmentRow from '@/components/ui/appointment-row'
import Card from '@/components/ui/card'
import Chip from '@/components/ui/chip'
import EmptyState from '@/components/ui/empty-state'
import FilterRow from '@/components/ui/filter-row'
import Sheet from '@/components/ui/sheet'
import StatTile from '@/components/ui/stat-tile'
import { dinheiro } from '@/lib/formato'
import { cn } from '@/lib/utils'

import DetalheAgendamento from './detalhe'

import { LIMIAR_ALERTA_AGENDA } from '@/core/risk/no-show-score'

import type { EstadoAgendamento } from '@/core/scheduling/state'
import type { LinhaAgendaDia, ResumoAgendaDia } from '@/server/services/agendamentos'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano!, mes! - 1, dia))
}

function paraISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Os 7 dias da semana (domingo a sábado) que contém `dia`. */
function semanaDe(dia: string): string[] {
  const d = paraData(dia)
  const domingo = new Date(d)
  domingo.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(domingo)
    dt.setUTCDate(domingo.getUTCDate() + i)
    return paraISO(dt)
  })
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Agenda({
  dia,
  resumo,
  profissionais,
  profissionalSelecionado,
}: {
  dia: string
  resumo: ResumoAgendaDia
  profissionais: { id: string; display_name: string }[]
  profissionalSelecionado?: string
}) {
  const router = useRouter()
  const [selecionado, setSelecionado] = useState<LinhaAgendaDia | null>(null)

  function navegar(novoDia: string, novoProfissional?: string) {
    const params = new URLSearchParams({ date: novoDia })
    const prof = novoProfissional ?? profissionalSelecionado
    if (prof) params.set('professionalId', prof)
    router.push(`/admin/agenda?${params.toString()}`)
  }

  const semana = semanaDe(dia)
  const hoje = paraISO(new Date())

  return (
    <div>
      {/*
        A faixa da semana é o controle mais tocado da tela. Antes o dia
        selecionado e "hoje" competiam com dois desenhos parecidos (fundo de
        acento vs. borda de acento) e nada dizia que a coluna era tocável. Agora
        o selecionado é sólido, hoje é um ponto sob o número, e o resto é
        superfície — três estados que se leem de relance, no sol.
      */}
      <div role="group" aria-label="Dias da semana" className="mb-4 flex justify-between gap-1">
        {semana.map((d) => {
          const data = paraData(d)
          const selecionado = d === dia
          return (
            <button
              key={d}
              type="button"
              onClick={() => navegar(d)}
              aria-current={selecionado ? 'date' : undefined}
              className={cn(
                'flex h-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-sm)]',
                'text-label font-semibold transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.95]',
                selecionado
                  ? 'bg-[image:var(--grad-acc)] text-on-acc shadow-elevado'
                  : 'bg-surface-2 text-txt-2 hover:bg-surface-3 hover:text-txt',
              )}
            >
              <span className="uppercase">{DIAS_SEMANA[data.getUTCDay()]}</span>
              <span className={cn('tabular text-corpo font-bold', !selecionado && 'text-txt')}>{data.getUTCDate()}</span>
              <span
                aria-hidden
                className={cn(
                  'size-1 rounded-[var(--radius-pill)]',
                  d === hoje ? (selecionado ? 'bg-on-acc' : 'bg-acc-2') : 'bg-transparent',
                )}
              />
            </button>
          )
        })}
      </div>

      {profissionais.length > 1 ? (
        <FilterRow rotulo="Filtrar por profissional" className="mb-4">
          <Chip ligado={!profissionalSelecionado} onClick={() => navegar(dia, '')}>
            Todos
          </Chip>
          {profissionais.map((p) => (
            <Chip key={p.id} ligado={profissionalSelecionado === p.id} onClick={() => navegar(dia, p.id)}>
              {p.display_name}
            </Chip>
          ))}
        </FilterRow>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatTile rotulo="Ocupação do dia" valor={`${Math.round(resumo.occupancyRate * 100)}%`} progresso={resumo.occupancyRate} />
        <StatTile rotulo="Previsto" valor={dinheiro.format(resumo.forecastCents / 100)} />
      </div>

      {resumo.appointments.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icone={<CalendarX aria-hidden className="size-6" />}
            titulo="Nada marcado nesse dia"
            descricao="Toque no botão + para criar o primeiro agendamento."
            acao={<Link href="/admin/agenda/novo">Novo agendamento</Link>}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {resumo.appointments.map((a: LinhaAgendaDia) => (
            <li key={a.id}>
              <button type="button" onClick={() => setSelecionado(a)} className="block w-full text-left">
                <AppointmentRow
                  horario={horaLocal(a.starts_at)}
                  clienteNome={a.clients?.name ?? 'Cliente'}
                  servicoNome={a.services?.name ?? 'Serviço'}
                  profissionalNome={profissionais.length > 1 ? a.professionals?.display_name : undefined}
                  status={a.status as EstadoAgendamento}
                  altoRisco={(a.no_show_score ?? 0) >= LIMIAR_ALERTA_AGENDA}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet aberto={!!selecionado} aoFechar={(aberto) => !aberto && setSelecionado(null)} titulo="Agendamento">
        {selecionado ? (
          <DetalheAgendamento
            agendamento={selecionado}
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
