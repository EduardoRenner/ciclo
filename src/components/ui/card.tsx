import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'> & {
  /** Superfície "no ar" (sheet, banner fixo, menu) — sombra mais forte que o repouso padrão. */
  flutuante?: boolean
  /**
   * O card é o alvo de um toque (linha de lista, item de configuração). Ganha
   * retorno de toque; sem isto o dedo aperta e nada acontece até a rota trocar,
   * que na rede do salão pode demorar meio segundo — tempo suficiente para a
   * pessoa achar que não funcionou e tocar de novo.
   */
  pressionavel?: boolean
}

/** `--surface`, borda `--line`, raio 16, sombra de repouso (§4). */
export default function Card({ className, flutuante, pressionavel, ...props }: Props) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-line bg-surface p-4 shadow-elevado',
        flutuante && 'shadow-flutuante',
        pressionavel &&
          'transition duration-[var(--dur-1)] ease-[var(--ease-ios)] hover:border-line-2 hover:bg-surface-2 active:scale-[.99] active:bg-surface-press',
        className,
      )}
      {...props}
    />
  )
}
