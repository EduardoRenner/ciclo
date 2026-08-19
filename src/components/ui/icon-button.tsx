import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const base = cva(
  // 48px cheios: é o alvo mínimo de §3.6, e ícone sozinho não tem texto para
  // aumentar a área de erro do dedo.
  'inline-grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] ' +
    'transition duration-[var(--dur-1)] active:scale-[.94]',
  {
    variants: {
      variante: {
        ghost: 'text-txt-2 hover:bg-surface-2 hover:text-txt',
        surface: 'border border-line-2 bg-surface-2 text-txt hover:bg-surface-3',
        acento: 'bg-acc-soft text-acc-2 hover:brightness-110',
      },
    },
    defaultVariants: { variante: 'ghost' },
  },
)

type Props = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof base> & {
    /** Obrigatório: botão só de ícone é mudo para o leitor de tela sem isto. */
    'aria-label': string
  }

/** Botão quadrado de ícone — voltar, engrenagem, cadastrar. Estava copiado à mão em 6 telas. */
export default function IconButton({ className, variante, ...props }: Props) {
  return <button className={cn(base({ variante }), className)} {...props} />
}
