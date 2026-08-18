import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  rotulo: string
  valor: string
  /** 0 a 1. Quando presente, desenha a barra de progresso de §4. */
  progresso?: number
}

/** Label overline + valor grande + barra opcional (§4). */
export default function StatTile({ className, rotulo, valor, progresso, ...props }: Props) {
  const pct = progresso === undefined ? null : Math.round(Math.min(1, Math.max(0, progresso)) * 100)

  return (
    <div
      className={cn('rounded-[var(--radius)] border border-line bg-surface p-4', className)}
      {...props}
    >
      <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">{rotulo}</p>
      <p className="tabular mt-1.5 text-stat font-extrabold text-txt">{valor}</p>

      {pct !== null ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-surface-3"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={rotulo}
        >
          <div
            className="h-full rounded-[var(--radius-pill)] bg-[linear-gradient(90deg,var(--acc),var(--acc-2))]"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
