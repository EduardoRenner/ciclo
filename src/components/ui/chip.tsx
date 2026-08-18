import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentPropsWithoutRef<'button'>, 'aria-pressed'> & {
  ligado?: boolean
}

/**
 * Filtro selecionável, altura 32 (§4). É `button` com `aria-pressed`, e não
 * checkbox disfarçado: o leitor de tela precisa anunciar que o filtro está ativo.
 */
export default function Chip({ className, ligado = false, ...props }: Props) {
  return (
    <button
      type="button"
      aria-pressed={ligado}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border px-3.5',
        'text-label font-semibold transition active:scale-[.97]',
        ligado ? 'border-acc bg-acc-soft text-acc-2' : 'border-line-2 bg-surface-2 text-txt-2',
        className,
      )}
      {...props}
    />
  )
}
