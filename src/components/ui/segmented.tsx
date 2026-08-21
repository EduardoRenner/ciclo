'use client'

import { useRef } from 'react'

import { cn } from '@/lib/utils'

export type Segmento = { valor: string; rotulo: string }

type Props = {
  segmentos: Segmento[]
  valor: string
  aoTrocar: (valor: string) => void
  /** Nome do grupo para o leitor de tela ("Seções da ficha"). */
  rotulo: string
  className?: string
}

/**
 * Navegação entre camadas de uma mesma tela — não entre telas (isso é a tab bar).
 *
 * Existe porque a ficha do cliente tinha 2429px numa pilha só: sete blocos de peso visual igual,
 * sem índice e sem como pular. Empilhar não é organizar; a ficha responde a três perguntas
 * diferentes ("quem é", "como atender", "quanto vale") e precisava parar de fingir que é uma.
 *
 * `role="tablist"` de verdade, com as setas do teclado que o padrão ARIA exige — um segmented
 * feito de `<button>` solto obriga a pessoa a dar Tab em cada aba para passar pela barra.
 * O trilho rola e sangra até a borda quando não cabe (mesma regra dos outros trilhos do app).
 */
export default function Segmented({ segmentos, valor, aoTrocar, rotulo, className }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function aoTeclar(e: React.KeyboardEvent, indice: number) {
    const passo = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (passo === 0) return
    e.preventDefault()
    // Circula em vez de parar na ponta: é o comportamento do controle nativo.
    const proximo = (indice + passo + segmentos.length) % segmentos.length
    aoTrocar(segmentos[proximo]!.valor)
    refs.current[proximo]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={rotulo}
      // `scroll-x` (globals.css) já resolve encaixe por item, barra escondida e esmaecimento
      // na borda — a mesma fileira rolável de `FilterRow`, sem reinventar.
      className={cn('scroll-x -mx-[var(--gutter)] gap-1.5 px-[var(--gutter)] pb-1', className)}
    >
      {segmentos.map((s, i) => {
        const ativo = s.valor === valor
        return (
          <button
            key={s.valor}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            aria-selected={ativo}
            // Só a aba ativa entra na ordem de Tab; as outras se alcançam pelas setas.
            tabIndex={ativo ? 0 : -1}
            onClick={() => aoTrocar(s.valor)}
            onKeyDown={(e) => aoTeclar(e, i)}
            className={cn(
              // 40px visuais + `toque-48`: mesma regra do `Chip`, o alvo cresce sem engordar o desenho.
              'toque-48 h-10 shrink-0 rounded-[var(--radius-pill)] border px-4 text-label font-semibold',
              'transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.96]',
              ativo
                ? 'border-acc bg-acc-soft text-acc-2'
                : 'border-line-2 bg-surface-2 text-txt-2 hover:bg-surface-3 hover:text-txt',
            )}
          >
            {s.rotulo}
          </button>
        )
      })}
    </div>
  )
}
