'use client'

import { useId } from 'react'

import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentPropsWithoutRef<'textarea'>, 'id'> & {
  rotulo: string
  ajuda?: string
  erro?: string
  className?: string
}

/** Mesma anatomia do `Input` (rótulo real, ajuda, erro com `aria-invalid`), em campo de várias linhas. */
export default function Textarea({ rotulo, ajuda, erro, className, rows = 4, ...props }: Props) {
  const id = useId()
  const idAjuda = `${id}-ajuda`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label font-semibold text-txt-2">
        {rotulo}
      </label>

      <textarea
        id={id}
        rows={rows}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro || ajuda ? idAjuda : undefined}
        className={cn(
          'w-full rounded-[var(--radius-sm)] border bg-surface-2 px-3.5 py-3 text-corpo text-txt',
          'transition-colors duration-[var(--dur-1)] placeholder:text-txt-3 focus:border-acc',
          erro ? 'border-bad' : 'border-line-2',
        )}
        {...props}
      />

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
