import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'>

/**
 * §4: toda lista e todo card têm esqueleto; nunca tela branca. `aria-hidden`
 * porque o leitor de tela não deve narrar caixas cinzas — quem anuncia o
 * carregamento é o `aria-busy` da região.
 */
export default function Skeleton({ className, ...props }: Props) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-[var(--radius-sm)] bg-surface-2', className)}
      {...props}
    />
  )
}
