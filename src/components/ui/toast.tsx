'use client'

import { Toast as RadixToast } from 'radix-ui'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import { cn } from '@/lib/utils'

type Tom = 'ok' | 'erro' | 'aviso'

type Aviso = { id: number; titulo: string; descricao?: string; tom: Tom }

const Contexto = createContext<((aviso: Omit<Aviso, 'id'>) => void) | null>(null)

/** Dispara um toast. Fora do provider, estoura na hora em vez de sumir calado. */
export function useToast() {
  const mostrar = useContext(Contexto)
  if (!mostrar) throw new Error('useToast precisa estar dentro de <ToastProvider>')
  return mostrar
}

const CORES: Record<Tom, string> = {
  ok: 'border-ok/40 text-ok',
  erro: 'border-bad/40 text-bad',
  aviso: 'border-warn/40 text-warn',
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])

  const mostrar = useCallback((aviso: Omit<Aviso, 'id'>) => {
    setAvisos((atuais) => [...atuais, { ...aviso, id: Date.now() + atuais.length }])
  }, [])

  const valor = useMemo(() => mostrar, [mostrar])

  return (
    <Contexto.Provider value={valor}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}

        {avisos.map((aviso) => (
          <RadixToast.Root
            key={aviso.id}
            onOpenChange={(aberto) => {
              if (!aberto) setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id))
            }}
            // §7: erro fala na frente da leitura em curso; sucesso espera a vez.
            type={aviso.tom === 'erro' ? 'foreground' : 'background'}
            className={cn(
              'rounded-[var(--radius-sm)] border bg-surface-2 px-4 py-3 shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
              CORES[aviso.tom],
            )}
          >
            <RadixToast.Title className="text-corpo font-semibold">{aviso.titulo}</RadixToast.Title>
            {aviso.descricao ? (
              <RadixToast.Description className="mt-0.5 text-secundario text-txt-2">
                {aviso.descricao}
              </RadixToast.Description>
            ) : null}
          </RadixToast.Root>
        ))}

        <RadixToast.Viewport
          className={cn(
            'fixed inset-x-0 bottom-0 z-[60] flex flex-col gap-2 p-[18px]',
            // Acima da tab bar de 82px (§3.3), senão o aviso nasce escondido.
            'pb-[calc(96px+env(safe-area-inset-bottom))]',
          )}
        />
      </RadixToast.Provider>
    </Contexto.Provider>
  )
}
