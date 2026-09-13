'use client'

import { Dialog } from 'radix-ui'
import { useState } from 'react'

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
  /*
   * Sem `container`, o `Dialog.Portal` do Radix monta em `document.body` por padrão — FORA do
   * `<div id="raiz-do-tema" data-theme>` que `admin/layout.tsx` embrulha em volta de tudo. As
   * variáveis de cor (`--bg`, `--surface`...) só existem dentro daquele wrapper, então todo Sheet
   * caía no fallback escuro de `:root` mesmo com "Claro" escolhido de verdade — medido ao vivo em
   * 2026-09-13 (docs/DECISOES.md), o app claro por trás com o Sheet sempre escuro por cima.
   *
   * Inicializador preguiçoso, não `useEffect`: o elemento já existe no HTML vindo do servidor
   * (é ancestral de tudo que renderiza um Sheet), então buscar durante o primeiro render acha na
   * hora — um `useEffect` atrasaria um commit e piscaria escuro→claro na primeira abertura.
   * `null` (SSR, ou o elemento raro de não existir) volta pro padrão do Radix, nunca quebra.
   */
  const [raizDoTema] = useState<HTMLElement | null>(() => (typeof document === 'undefined' ? null : document.getElementById('raiz-do-tema')))

  return (
    <Dialog.Root open={aberto} onOpenChange={aoFechar}>
      {gatilho ? <Dialog.Trigger asChild>{gatilho}</Dialog.Trigger> : null}

      <Dialog.Portal container={raizDoTema ?? undefined}>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />

        <Dialog.Content
          className={cn(
            // `mx-auto max-w-[560px]` acompanha a coluna do app: sem isto o
            // sheet nascia com a largura do monitor enquanto o conteúdo atrás
            // dele vivia numa coluna de 560px.
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-[560px] overflow-y-auto overscroll-contain',
            'rounded-t-[var(--radius-sheet)] border-t border-line-2 bg-surface shadow-flutuante',
            // A folga extra embaixo é a área do gesto de voltar do iPhone.
            'px-[var(--gutter)] pb-[calc(24px+env(safe-area-inset-bottom))] pt-3',
            'duration-[var(--dur-3)] ease-[var(--ease-ios)]',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
            className,
          )}
        >
          <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-[var(--radius-pill)] bg-line-2" />

          <Dialog.Title className="text-titulo font-bold text-txt">{titulo}</Dialog.Title>
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
