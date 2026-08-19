import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  icone?: React.ReactNode
  /** `alerta` é o tom usado nas seções de "precisa de atenção" (confirmação pendente, estoque). */
  tom?: 'neutro' | 'alerta'
  className?: string
}

/** Cabeçalho de seção — estava duplicado 4x em `hoje.tsx` com a mesma string de classe. */
export default function SectionHeader({ children, icone, tom = 'neutro', className }: Props) {
  return (
    <h2
      className={cn(
        'mb-3 flex items-center gap-1.5 text-overline font-semibold uppercase tracking-[0.13em]',
        tom === 'alerta' ? 'text-warn' : 'text-txt-3',
        className,
      )}
    >
      {icone}
      {children}
    </h2>
  )
}
