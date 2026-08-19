'use client'

import { Dialog } from 'radix-ui'

import { cn } from '@/lib/utils'

type Props = {
  aberto: boolean
  aoFechar: (aberto: boolean) => void
  titulo: string
  /** Some da tela mas continua no leitor: o sheet precisa se descrever. */
  descricao?: string
  gatilho?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/**
 * Bottom sheet (§3.4): detalhe abre aqui, não em página nova, para não perder o
 * contexto da agenda. O Radix já trava o scroll do fundo e devolve o foco ao
 * fechar; o handle no topo é a área de arrasto.
 */
export default function Sheet({ aberto, aoFechar, titulo, descricao, gatilho, className, children }: Props) {
  return (
    <Dialog.Root open={aberto} onOpenChange={aoFechar}>
      {gatilho ? <Dialog.Trigger asChild>{gatilho}</Dialog.Trigger> : null}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />

        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto',
            'rounded-t-[var(--radius)] border-t border-line-2 bg-surface shadow-flutuante',
            // A folga extra embaixo é a área do gesto de voltar do iPhone.
            'px-[18px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-3',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-[var(--radius-pill)] bg-line-2" />

          <Dialog.Title className="text-titulo font-extrabold text-txt">{titulo}</Dialog.Title>
          {descricao ? (
            <Dialog.Description className="mt-1 text-secundario text-txt-2">{descricao}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
          )}

          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
