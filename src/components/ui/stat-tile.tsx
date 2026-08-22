import { cn } from '@/lib/utils'

import Card from './card'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  rotulo: string
  valor: string
  /** 0 a 1. Quando presente, desenha a barra de progresso de §4. */
  progresso?: number
  /**
   * O número que a tela existe para mostrar (o faturado do dia, em "Hoje").
   * Usa `--text-numero` — o maior tamanho da escala, que estava definido desde
   * o primeiro dia e **não era usado em lugar nenhum**: a única métrica de
   * dinheiro da tela principal tinha o mesmo peso de um contador qualquer.
   */
  heroi?: boolean
  /** Linha de contexto sob o valor ("+18% que ontem"). Número sozinho não diz se é bom. */
  apoio?: React.ReactNode
  /** Repassado ao `Card`: o número leva a algum lugar (o faturado do dia abre o caixa). */
  pressionavel?: boolean
}

/** Label overline + valor grande + barra opcional (§4). Compõe `Card` — ganha a sombra de repouso de graça, sem duplicar borda/fundo/raio. */
export default function StatTile({ className, rotulo, valor, progresso, heroi, apoio, pressionavel, ...props }: Props) {
  const pct = progresso === undefined ? null : Math.round(Math.min(1, Math.max(0, progresso)) * 100)

  return (
    <Card className={className} pressionavel={pressionavel} {...props}>
      <p className="text-overline font-semibold uppercase text-txt-3">{rotulo}</p>
      {/* `tracking-tight` vem do token do tamanho — é o que separa "número grande" de "número desenhado" (Linear/Stripe fazem o mesmo nas telas de valor). */}
      <p className={cn('tabular mt-1.5 font-bold text-txt', heroi ? 'text-numero' : 'text-stat')}>{valor}</p>

      {apoio ? <div className="mt-1 text-secundario text-txt-2">{apoio}</div> : null}

      {pct !== null ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-surface-3"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={rotulo}
        >
          {/*
            Acento sólido, não gradiente: o gradiente é a assinatura da marca
            (FAB, botão primário, monograma) e perde o sentido quando aparece
            também numa barra de 6px de altura, onde ninguém enxerga os dois
            tons mesmo.
          */}
          <div className="h-full rounded-[var(--radius-pill)] bg-acc transition-[width] duration-[var(--dur-3)] ease-[var(--ease-ios)]" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </Card>
  )
}
