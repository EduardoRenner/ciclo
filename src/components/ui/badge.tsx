import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, Check, Clock, Lock, Sparkles, X } from 'lucide-react'

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

/** Marcador de cada estado, na ordem de §5 — ícone `lucide-react`, não emoji: mesmo sistema usado no resto do app, sem depender de fonte de emoji do SO/navegador. */
const MARCA = {
  ok: Check,
  warn: Clock,
  risk: AlertTriangle,
  bad: X,
  info: Lock,
  ciclo: Sparkles,
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
  const Icone = MARCA[estado ?? 'ok']
  return (
    <span className={cn(selo({ estado }), className)} {...props}>
      <Icone aria-hidden className="size-3.5 shrink-0" />
      {children}
    </span>
  )
}
