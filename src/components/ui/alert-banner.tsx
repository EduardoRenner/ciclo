import { cva, type VariantProps } from 'class-variance-authority'
import { AlertTriangle, Sparkles, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'

const faixa = cva('flex items-center gap-3 rounded-[var(--radius)] border p-3.5 text-corpo', {
  variants: {
    tom: {
      acento: 'border-acc/35 bg-acc-soft text-txt',
      warn: 'border-warn/30 bg-warn/8 text-txt',
      risk: 'border-risk/30 bg-risk/8 text-txt',
      danger: 'border-bad/35 bg-bad/8 text-txt',
    },
  },
  defaultVariants: { tom: 'acento' },
})

const ICONE = {
  acento: Sparkles,
  warn: AlertTriangle,
  risk: TriangleAlert,
  danger: TriangleAlert,
} as const

const COR_ICONE = {
  acento: 'text-acc-2',
  warn: 'text-warn',
  risk: 'text-risk',
  danger: 'text-bad',
} as const

type Props = React.ComponentPropsWithoutRef<'div'> &
  VariantProps<typeof faixa> & {
    /** Texto curto à direita quando a faixa leva a algum lugar ("Recuperar"). */
    acao?: React.ReactNode
    children: React.ReactNode
  }

/**
 * `AlertBanner` de `03-DESIGN-SYSTEM §4` — obrigatório desde o começo e nunca
 * feito. Sem ele, cada tela improvisou com `Card` + borda colorida
 * (`clientes/page.tsx`, `recuperar/page.tsx`, `recuperar.tsx`), com um tom
 * diferente em cada uma. §4 também manda: estado nunca só por cor — daí o
 * ícone fixo por tom.
 */
export default function AlertBanner({ className, tom, acao, children, ...props }: Props) {
  const Icone = ICONE[tom ?? 'acento']

  return (
    <div className={cn(faixa({ tom }), className)} {...props}>
      <Icone aria-hidden className={cn('size-5 shrink-0', COR_ICONE[tom ?? 'acento'])} />
      <div className="min-w-0 flex-1">{children}</div>
      {acao ? <div className="shrink-0 text-secundario font-semibold">{acao}</div> : null}
    </div>
  )
}
