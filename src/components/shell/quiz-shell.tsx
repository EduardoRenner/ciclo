import { ChevronLeft } from 'lucide-react'

import IconeAnel from '@/components/ui/icone-anel'

/**
 * Casca visual do cadastro em etapas (uma pergunta por tela, barra de progresso, botão voltar) —
 * referência trazida pelo Eduardo (fluxo de onboarding tipo quiz de apps como o do print "Z").
 * Cada etapa é responsabilidade de quem chama; este componente só desenha o topo e o corpo.
 */
export default function QuizShell({
  passo,
  total,
  aoVoltar,
  children,
}: {
  /** 0-indexado. */
  passo: number
  total: number
  /** Omitido (ou `undefined`) na primeira etapa — não existe pra onde voltar. */
  aoVoltar?: () => void
  children: React.ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden px-[18px] py-6">
      <div className="flex items-center gap-3">
        <IconeAnel role="img" aria-label="CICLO" className="size-7 shrink-0 text-acc" />
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={passo + 1} aria-valuemin={1} aria-valuemax={total}>
          <div
            className="h-full rounded-full bg-acc transition-[width] duration-300 ease-[var(--ease-ios)]"
            style={{ width: `${((passo + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-6">
        {aoVoltar ? (
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar"
            className="toque-48 grid size-12 place-items-center rounded-[var(--radius-pill)] bg-surface-2 text-txt-2 transition hover:bg-surface-3"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
        ) : null}
      </div>

      <div key={passo} className="mt-6 flex w-full max-w-sm flex-1 animate-in flex-col gap-3 self-center fade-in slide-in-from-bottom-2 duration-300">
        {children}
      </div>
    </main>
  )
}
