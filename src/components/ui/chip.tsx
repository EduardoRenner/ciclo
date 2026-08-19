import { cn } from '@/lib/utils'

type Props = Omit<React.ComponentPropsWithoutRef<'button'>, 'aria-pressed'> & {
  ligado?: boolean
}

/**
 * Filtro selecionável. É `button` com `aria-pressed`, e não checkbox
 * disfarçado: o leitor de tela precisa anunciar que o filtro está ativo.
 *
 * §4 pedia altura 32 — que viola o próprio §3.6 (alvo ≥ 48px) do mesmo
 * documento, e a conta apareceu na medição: 32px é o alvo do filtro de
 * profissional na agenda **e de cada horário livre no agendamento público**, ou
 * seja, a cliente escolhendo o horário dela num alvo de 32px. A pílula fica com
 * 40px de altura visual e o utilitário `toque-48` estende a área tocável para
 * 48 sem engordar o desenho.
 */
export default function Chip({ className, ligado = false, ...props }: Props) {
  return (
    <button
      type="button"
      aria-pressed={ligado}
      className={cn(
        'toque-48 inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border px-4',
        'text-label font-semibold transition duration-[var(--dur-1)] ease-[var(--ease-ios)] active:scale-[.96]',
        ligado
          ? 'border-acc bg-acc-soft text-acc-2'
          : 'border-line-2 bg-surface-2 text-txt-2 hover:bg-surface-3 hover:text-txt',
        className,
      )}
      {...props}
    />
  )
}
