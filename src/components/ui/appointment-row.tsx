import { cn } from '@/lib/utils'

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
}

/** §4: barra lateral de 3px colorida por status, horário à esquerda em tabular. */
export default function AppointmentRow({
  className,
  horario,
  clienteNome,
  servicoNome,
  status,
  profissionalNome,
  ...props
}: Props) {
  return (
    <div
      className={cn('flex overflow-hidden rounded-[var(--radius)] border border-line bg-surface', className)}
      {...props}
    >
      <div aria-hidden className={cn('w-[3px] shrink-0', COR_BARRA[status])} />
      <div className="flex flex-1 items-center gap-3 px-3 py-3">
        <p className="tabular w-14 shrink-0 text-corpo font-semibold text-txt">{horario}</p>
        <div className="min-w-0 flex-1">
          <p className="truncate text-corpo font-semibold text-txt">{clienteNome}</p>
          <p className="truncate text-secundario text-txt-2">
            {servicoNome}
            {profissionalNome ? ` · ${profissionalNome}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-label font-semibold text-txt-3">{ROTULO_ESTADO[status]}</span>
      </div>
    </div>
  )
}
