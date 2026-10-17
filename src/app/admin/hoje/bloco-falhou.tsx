'use client'

import { RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import Card from '@/components/ui/card'

/**
 * APR-106 (docs/98 I-04, G-15): um bloco da Hoje que não carregou DIZ que não carregou. Antes o
 * `catch` devolvia um objeto zerado e a tela desenhava "R$ 0,00" com cara de número apurado, na tela
 * mais vista do produto. O resto da Hoje continua abrindo; só este bloco pede para tentar de novo.
 */
export default function BlocoFalhou({ oQue, className = '' }: { oQue: string; className?: string }) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  return (
    <Card role="alert" className={`flex items-center justify-between gap-3 border-warn/40 ${className}`}>
      <p className="text-secundario text-txt-2">
        Não consegui carregar {oQue}. O resto da tela está certo.
      </p>
      <button
        type="button"
        disabled={pendente}
        onClick={() => iniciar(() => router.refresh())}
        className="flex h-12 shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-3 text-secundario font-semibold text-acc-2 transition hover:bg-surface-2 active:scale-[.97] disabled:opacity-60"
      >
        <RotateCcw aria-hidden className="size-4" />
        Tentar de novo
      </button>
    </Card>
  )
}
