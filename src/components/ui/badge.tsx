import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const selo = cva(
  'inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2.5 py-1 text-label font-semibold',
  {
    variants: {
      estado: {
        ok: 'bg-ok/15 text-ok',
        warn: 'bg-warn/15 text-warn',
        risk: 'bg-risk/15 text-risk',
        bad: 'bg-bad/15 text-bad',
        info: 'bg-info/15 text-info',
        ciclo: 'bg-acc-soft text-acc-2',
      },
    },
    defaultVariants: { estado: 'ok' },
  },
)

/** Marcador de cada estado, na ordem de §5. */
const MARCA = {
  ok: '✓',
  warn: '⏳',
  risk: '⚠',
  bad: '✕',
  info: '🔒',
  ciclo: '✦',
} as const

type Props = React.ComponentPropsWithoutRef<'span'> &
  VariantProps<typeof selo> & {
    children: React.ReactNode
  }

/**
 * §4: estado sempre com **cor + ícone/texto**, nunca só cor — quem não
 * distingue verde de laranja precisa ler o mesmo que os outros.
 */
export default function Badge({ className, estado, children, ...props }: Props) {
  return (
    <span className={cn(selo({ estado }), className)} {...props}>
      <span aria-hidden>{MARCA[estado ?? 'ok']}</span>
      {children}
    </span>
  )
}
