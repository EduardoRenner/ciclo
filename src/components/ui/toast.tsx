'use client'

import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react'
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

/** §4: estado nunca só por cor. Quem não distingue verde de vermelho lê o ícone. */
const MARCA: Record<Tom, typeof CheckCircle2> = {
  ok: CheckCircle2,
  erro: XCircle,
  aviso: TriangleAlert,
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

        {avisos.map((aviso) => {
          const Icone = MARCA[aviso.tom]
          return (
          <RadixToast.Root
            key={aviso.id}
            onOpenChange={(aberto) => {
              if (!aberto) setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id))
            }}
            // §7: erro fala na frente da leitura em curso; sucesso espera a vez.
            type={aviso.tom === 'erro' ? 'foreground' : 'background'}
            className={cn(
              'flex items-start gap-2.5 rounded-[var(--radius-sm)] border bg-surface-2 px-4 py-3 shadow-flutuante',
              'duration-[var(--dur-2)] ease-[var(--ease-ios)]',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out',
              CORES[aviso.tom],
            )}
          >
            <Icone aria-hidden className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <RadixToast.Title className="text-corpo font-semibold">{aviso.titulo}</RadixToast.Title>
              {aviso.descricao ? (
                <RadixToast.Description className="mt-0.5 text-secundario text-txt-2">
                  {aviso.descricao}
                </RadixToast.Description>
              ) : null}
            </div>
          </RadixToast.Root>
          )
        })}

        <RadixToast.Viewport
          className={cn(
            'fixed inset-x-0 bottom-0 z-[60] mx-auto flex w-full max-w-[560px] flex-col gap-2 p-[var(--gutter)]',
            // Acima da tab bar, senão o aviso nasce escondido. A altura vem do
            // token, não de um 96 solto que envelhece junto com a barra.
            'pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+16px)]',
            /*
             * No monitor o toast é irmão do shell, então não herdava o recuo da coluna de
             * navegação que `admin/layout.tsx` aplica ao conteúdo: medido a 1440px, o aviso
             * nascia em x=440 enquanto o conteúdo começa em 557 — 117px à esquerda, invadindo
             * a faixa da barra lateral. Recuar o `left` faz o `mx-auto` centralizar no mesmo
             * espaço que o conteúdo, que é onde a pessoa está olhando.
             */
            'lg:left-[var(--sidebar-w)] lg:right-0',
          )}
        />
      </RadixToast.Provider>
    </Contexto.Provider>
  )
}
