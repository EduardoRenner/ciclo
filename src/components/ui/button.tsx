import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const botao = cva(
  // h-12 = 48px, o alvo mínimo de §3.6. `active:scale` no lugar de hover: no
  // celular não existe hover, e o toque precisa de retorno.
  'inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-5 ' +
    'text-corpo font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variante: {
        primary: 'bg-[linear-gradient(135deg,var(--acc),var(--acc-2))] text-[#0a0a0f]',
        secondary: 'bg-surface-2 text-txt border border-line-2',
        success: 'bg-ok text-[#0a0a0f]',
        danger: 'bg-bad text-[#0a0a0f]',
      },
      largura: {
        auto: '',
        cheia: 'w-full',
      },
    },
    defaultVariants: { variante: 'primary', largura: 'auto' },
  },
)

type Props = React.ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof botao> & {
    carregando?: boolean
    /**
     * Obrigatório quando o botão está desabilitado: §4 manda nunca desabilitar
     * sem explicar o motivo. Vira o `title` e o texto do leitor de tela.
     */
    motivoDesabilitado?: string
  }

export default function Button({
  className,
  variante,
  largura,
  carregando = false,
  motivoDesabilitado,
  disabled,
  children,
  ...props
}: Props) {
  const travado = disabled || carregando

  return (
    <button
      className={cn(botao({ variante, largura }), className)}
      disabled={travado}
      aria-busy={carregando || undefined}
      title={disabled ? motivoDesabilitado : undefined}
      {...props}
    >
      {carregando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
      {disabled && motivoDesabilitado ? <span className="sr-only">{motivoDesabilitado}</span> : null}
    </button>
  )
}
