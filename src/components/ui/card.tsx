import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  /** Superfície "no ar" (sheet, banner fixo, menu) — sombra mais forte que o repouso padrão. */
  flutuante?: boolean
}

/** `--surface`, borda `--line`, raio 16, sombra de repouso (§4). */
export default function Card({ className, flutuante, ...props }: Props) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-line bg-surface p-4 shadow-elevado',
        flutuante && 'shadow-flutuante',
        className,
      )}
      {...props}
    />
  )
}
