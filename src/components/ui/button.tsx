import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const botao = cva(
  // `active:scale` no lugar de hover: no celular não existe hover, e o toque
  // precisa de retorno. A curva é a de saída do iOS (`--ease-ios`): sai rápido,
  // chega devagar — é o que faz o toque parecer resposta, não animação.
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold ' +
    'transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.97] ' +
    'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      // `hover:` nunca dispara sozinho em touch — só complementa o `active:scale`
      // que já existia, para quem está com mouse (o Eduardo testando no desktop)
      // não ver a interface inteira "morta" ao passar o cursor.
      variante: {
        primary: 'bg-acc text-on-acc shadow-elevado hover:brightness-110',
        secondary: 'border border-line-2 bg-surface-2 text-txt hover:bg-surface-3',
        success: 'bg-ok text-on-acc hover:brightness-110',
        danger: 'bg-bad text-on-acc hover:brightness-110',
        /** Sem fundo — ação secundária dentro de card/sheet, onde mais uma caixa polui. */
        ghost: 'text-txt-2 hover:bg-surface-2 hover:text-txt',
      },
      tamanho: {
        // h-12 = 48px, o alvo mínimo de §3.6, e o padrão de toda ação de tela.
        md: 'h-12 px-5 text-corpo',
        // 40px de altura visual com área de toque de 48 (`toque-48`): ação
        // dentro de linha de lista, onde um botão de 48 empurra a linha inteira.
        sm: 'toque-48 h-10 px-4 text-secundario',
      },
      largura: {
        auto: '',
        cheia: 'w-full',
      },
    },
    defaultVariants: { variante: 'primary', tamanho: 'md', largura: 'auto' },
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
  tamanho,
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
      className={cn(botao({ variante, tamanho, largura }), className)}
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
