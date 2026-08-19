'use client'

import { RotateCcw } from 'lucide-react'
import Link from 'next/link'

import Button from '@/components/ui/button'
import Selo from '@/components/shell/selo'
import TelaPublica from '@/components/shell/tela-publica'

/**
 * Não existia `error.tsx` em nenhuma rota do projeto: qualquer falha de
 * servidor caía na página crua do Next — em inglês, fundo branco, sem saída —
 * dentro de um app que é preto, em português e mobile-first. `§6` do design
 * system manda o erro explicar o que fazer, não só que deu erro.
 *
 * `reset()` re-renderiza o segmento sem recarregar a página inteira: numa rede
 * de subsolo isso é a diferença entre um toque e vinte segundos.
 */
export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <TelaPublica>
      <Selo />
      <div className="text-center">
        <h1 className="text-titulo font-bold">Algo saiu do lugar</h1>
        <p className="mt-2 max-w-[34ch] text-corpo text-txt-2">
          Não consegui carregar esta tela. Seus dados estão salvos — foi só a exibição que falhou.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>
          <RotateCcw aria-hidden className="size-4" />
          Tentar de novo
        </Button>
        <Link
          href="/admin/hoje"
          className="inline-flex h-12 items-center justify-center rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-5 text-corpo font-semibold text-txt transition hover:bg-surface-3 active:scale-[.97]"
        >
          Ir para Hoje
        </Link>
      </div>
    </TelaPublica>
  )
}
