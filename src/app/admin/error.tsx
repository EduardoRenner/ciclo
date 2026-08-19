'use client'

import { RotateCcw } from 'lucide-react'

import Button from '@/components/ui/button'
import Card from '@/components/ui/card'

/**
 * Erro dentro do shell do profissional: mantém topbar e tab bar de pé, para a
 * pessoa poder ir para outra aba em vez de ficar presa. Um `error.tsx` na raiz
 * do app substituiria a tela inteira e tiraria a navegação junto.
 */
export default function ErroDoApp({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mt-8 flex flex-col items-center px-6 py-12 text-center">
      <p className="text-corpo font-semibold text-txt">Não consegui carregar esta tela</p>
      <p className="mt-1 max-w-[34ch] text-secundario text-txt-2">
        Pode ter sido a conexão. Nada do que você salvou foi perdido.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        <RotateCcw aria-hidden className="size-4" />
        Tentar de novo
      </Button>
    </Card>
  )
}
