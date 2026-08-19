import { AlertTriangle, Zap } from 'lucide-react'

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
  return (
    <Card className={cn('flex overflow-hidden p-0 transition hover:border-line-2 hover:bg-surface-2', className)} {...props}>
      <div aria-hidden className={cn('w-[3px] shrink-0', COR_BARRA[status])} />
      <div className="flex flex-1 items-center gap-3 px-3 py-3">
        <p className="tabular w-14 shrink-0 text-corpo font-semibold text-txt">{horario}</p>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-corpo font-semibold text-txt">
            {altoRisco ? (
              <span title="Risco alto de falta">
                <Zap aria-hidden className="size-4 shrink-0 text-warn" />
                <span className="sr-only">Risco alto de falta</span>
              </span>
            ) : null}
            {alertaSaude ? (
              <span title="Atenção na ficha de saúde">
                <AlertTriangle aria-hidden className="size-4 shrink-0 text-bad" />
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
        <span className="shrink-0 text-label font-semibold text-txt-3">{ROTULO_ESTADO[status]}</span>
      </div>
    </Card>
  )
}
