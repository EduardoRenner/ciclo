'use client'

import { ChevronDown } from 'lucide-react'
import { useId } from 'react'

import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentPropsWithoutRef<'select'>, 'id'> & {
  rotulo: string
  ajuda?: string
  erro?: string
  className?: string
}

/**
 * `select` nativo, de propósito: no celular ele abre a roleta do sistema, que é
 * mais rápida e mais familiar que qualquer lista customizada — e funciona com o
 * leitor de tela sem trabalho nenhum. O que ele não tem por padrão é aparência;
 * é só isso que este componente resolve (`appearance-none` + a seta do lucide,
 * o mesmo conjunto de ícones do resto do app).
 */
export default function Select({ rotulo, ajuda, erro, className, children, ...props }: Props) {
  const id = useId()
  const idAjuda = `${id}-ajuda`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-semibold text-txt-2">
        {rotulo}
      </label>

      <div className="relative">
        <select
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro || ajuda ? idAjuda : undefined}
          className={cn(
            'h-12 w-full appearance-none rounded-[var(--radius-sm)] border bg-surface-2 pl-3.5 pr-10 text-corpo text-txt',
            'transition-colors duration-[var(--dur-1)] focus:border-acc',
            erro ? 'border-bad' : 'border-line-2',
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-txt-3"
        />
      </div>

      {erro ? (
        <p id={idAjuda} role="alert" className="text-secundario text-bad">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={idAjuda} className="text-secundario text-txt-3">
          {ajuda}
        </p>
      ) : null}
    </div>
  )
}
