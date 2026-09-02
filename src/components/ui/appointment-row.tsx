import { TriangleAlert, ChevronRight, UserX } from 'lucide-react'

import { cn } from '@/lib/utils'

import Card from './card'

import type { EstadoAgendamento } from '@/core/scheduling/state'

/** §5: as mesmas cores de estado usadas em `Badge`, aqui na barra lateral do agendamento. */
const COR_BARRA: Record<EstadoAgendamento, string> = {
  pending: 'bg-warn',
  confirmed: 'bg-ok',
  arrived: 'bg-info',
  done: 'bg-txt-3',
  no_show: 'bg-bad',
  canceled: 'bg-bad',
  expired: 'bg-txt-3',
}

/** O rótulo do estado repete a cor da barra em texto — §4: nunca só cor. */
const COR_ROTULO: Record<EstadoAgendamento, string> = {
  pending: 'text-warn',
  confirmed: 'text-ok',
  arrived: 'text-info',
  done: 'text-txt-3',
  no_show: 'text-bad',
  canceled: 'text-bad',
  expired: 'text-txt-3',
}

const ROTULO_ESTADO: Record<EstadoAgendamento, string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  arrived: 'Chegou',
  done: 'Concluído',
  no_show: 'Faltou',
  canceled: 'Cancelado',
  expired: 'Vencido',
}

type Props = React.ComponentPropsWithoutRef<'div'> & {
  horario: string
  clienteNome: string
  servicoNome: string
  status: EstadoAgendamento
  profissionalNome?: string
  /** §5.4: `score ≥ 0,60` acende o alerta de risco de falta. */
  altoRisco?: boolean
  /** §9/TICKET-050: `health_records.has_alert` — nunca o rótulo clínico, só o sinal. */
  alertaSaude?: boolean
}

/** §4: barra lateral de 3px colorida por status, horário à esquerda em tabular. */
export default function AppointmentRow({
  className,
  horario,
  clienteNome,
  servicoNome,
  status,
  profissionalNome,
  altoRisco,
  alertaSaude,
  ...props
}: Props) {
  const concluido = status === 'done' || status === 'canceled' || status === 'expired'

  return (
    <Card pressionavel className={cn('flex overflow-hidden p-0', className)} {...props}>
      <div aria-hidden className={cn('w-[3px] shrink-0', COR_BARRA[status])} />
      <div className="flex flex-1 items-center gap-3 px-3.5 py-3">
        {/*
          O horário é a coluna que a pessoa varre com o olho para achar "que
          horas é a próxima" — ganha peso próprio e a linha de estado embaixo,
          em vez de o estado ficar solto na ponta direita competindo com o valor.
        */}
        {/*
          72px, não 52: a largura tinha sido dimensionada para o horário ("10:00" mede 32px) e o
          rótulo de estado embaixo não cabia. Medido em Archivo: "Aguardando" 69px, "Confirmado"
          66, "Cancelado" 60, "Concluído" 57 — quatro dos sete estados vazavam a coluna e
          encostavam no nome do serviço ao lado, e os dois piores são justamente o de todo
          agendamento novo e o de todo agendamento aceito ("AguardandoCorte").
        */}
        <div className="w-[72px] shrink-0">
          <p className={cn('tabular text-corpo font-bold', concluido ? 'text-txt-3' : 'text-txt')}>{horario}</p>
          <p className={cn('text-label font-semibold', COR_ROTULO[status])}>{ROTULO_ESTADO[status]}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'flex items-center gap-1 truncate text-corpo font-semibold',
              concluido ? 'text-txt-2' : 'text-txt',
            )}
          >
            {altoRisco ? (
              <span title="Risco alto de falta">
                <UserX aria-hidden className="size-4 shrink-0 text-warn" />
                <span className="sr-only">Risco alto de falta</span>
              </span>
            ) : null}
            {alertaSaude ? (
              <span title="Atenção na ficha de saúde">
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-bad" />
                <span className="sr-only">Atenção na ficha de saúde</span>
              </span>
            ) : null}
            <span className="truncate">{clienteNome}</span>
          </p>
          <p className="truncate text-secundario text-txt-2">
            {servicoNome}
            {profissionalNome ? ` · ${profissionalNome}` : ''}
          </p>
        </div>

        {/* A linha sempre abre o detalhe em sheet; a seta é o que diz isso sem texto. */}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-txt-3" />
      </div>
    </Card>
  )
}
