'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { estadoDoBotao, posicaoDaBolha } from '@/core/ui/botao-travado'
import { cn } from '@/lib/utils'

const botao = cva(
  // `active:scale` no lugar de hover: no celular não existe hover, e o toque
  // precisa de retorno. A curva é a de saída do iOS (`--ease-ios`): sai rápido,
  // chega devagar — é o que faz o toque parecer resposta, não animação.
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold ' +
    'transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.97] ' +
    'disabled:pointer-events-none disabled:opacity-50 ' +
    // travado COM motivo (docs/102 M1.4): parece travado, mas recebe o toque para explicar por quê
    'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:active:scale-100',
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
     * sem explicar o motivo. Vira o `title`, o texto do leitor de tela e a bolha
     * que aparece quando a pessoa toca no botão travado.
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
  onClick,
  ...props
}: Props) {
  const estado = estadoDoBotao({ disabled, carregando, motivo: motivoDesabilitado })
  const ref = useRef<HTMLButtonElement>(null)
  const [bolha, setBolha] = useState<{ top: number } | { bottom: number } | null>(null)

  useEffect(() => {
    if (!estado.explicaNoToque) setBolha(null)
  }, [estado.explicaNoToque])

  useEffect(() => {
    if (!bolha) return
    const fechar = () => setBolha(null)
    const tempo = setTimeout(fechar, 4000)
    window.addEventListener('scroll', fechar, { passive: true })
    return () => {
      clearTimeout(tempo)
      window.removeEventListener('scroll', fechar)
    }
  }, [bolha])

  return (
    <>
      <button
        ref={ref}
        className={cn(botao({ variante, tamanho, largura }), className)}
        disabled={estado.disabledNativo}
        aria-disabled={estado.ariaDisabled || undefined}
        aria-busy={carregando || undefined}
        title={disabled ? motivoDesabilitado : undefined}
        onClick={(e) => {
          if (estado.explicaNoToque) {
            // nunca executa a ação nem envia o formulário (inclusive o envio implícito pelo Enter)
            e.preventDefault()
            const r = ref.current?.getBoundingClientRect()
            if (r) setBolha(posicaoDaBolha(r, window.innerHeight))
            return
          }
          onClick?.(e)
        }}
        {...props}
      >
        {carregando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        {children}
        {disabled && motivoDesabilitado ? <span className="sr-only">{motivoDesabilitado}</span> : null}
      </button>
      {/*
        Portal: `position: fixed` dentro de ancestral com `transform` (a `entrada-de-tela` de toda rota)
        se posiciona pelo ancestral, não pela tela; medido em 2026-10-08, a bolha caía 15 px em cima do
        botão. Vai para `#raiz-do-tema` (onde moram os tokens do tema do salão) ou para o `body`.
      */}
      {bolha
        ? createPortal(
        <span
          role="status"
          className="fixed inset-x-4 z-50 mx-auto w-fit max-w-[28rem] rounded-[var(--radius-sm)] bg-txt px-3 py-2 text-secundario font-semibold text-bg shadow-elevado"
          style={bolha}
        >
          {motivoDesabilitado}
        </span>,
            document.getElementById('raiz-do-tema') ?? document.body,
          )
        : null}
    </>
  )
}
