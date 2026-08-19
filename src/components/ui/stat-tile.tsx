import Card from './card'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  rotulo: string
  valor: string
  /** 0 a 1. Quando presente, desenha a barra de progresso de §4. */
  progresso?: number
}

/** Label overline + valor grande + barra opcional (§4). Compõe `Card` — ganha a sombra de repouso de graça, sem duplicar borda/fundo/raio. */
export default function StatTile({ className, rotulo, valor, progresso, ...props }: Props) {
  const pct = progresso === undefined ? null : Math.round(Math.min(1, Math.max(0, progresso)) * 100)

  return (
    <Card className={className} {...props}>
      <p className="text-overline font-semibold uppercase tracking-[0.13em] text-txt-3">{rotulo}</p>
      {/* `tracking-tight` no valor grande — é o que separa "número grande" de "número desenhado" (Linear/Stripe fazem o mesmo nas telas de valor). */}
      <p className="tabular mt-1.5 text-stat font-extrabold tracking-tight text-txt">{valor}</p>

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
    </Card>
  )
}
