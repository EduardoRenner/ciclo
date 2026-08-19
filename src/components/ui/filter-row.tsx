import { cn } from '@/lib/utils'

type Props = {
  /** Descreve o grupo para o leitor de tela ("Filtrar por estado do ciclo"). */
  rotulo: string
  children: React.ReactNode
  className?: string
}

/**
 * Fileira de filtros. Existiam três implementações paralelas da mesma coisa
 * (`Chip` na agenda, pílulas à mão em `clientes/lista.tsx` e em
 * `recuperar.tsx`), com raio, altura e cor de borda diferentes — o mesmo gesto
 * parecia três controles distintos.
 *
 * `scroll-x` (utilitário de `globals.css`) traz o que faltava nas três: parada
 * por item, barra escondida e esmaecimento na borda — sem ele a fileira corta
 * no seco e nada indica que há mais filtros fora da tela. As sangrias negativas
 * levam a rolagem até a borda do aparelho; sem elas o último item encosta numa
 * parede invisível a 18px da beirada.
 */
export default function FilterRow({ rotulo, children, className }: Props) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn('scroll-x -mx-[var(--gutter)] gap-2 px-[var(--gutter)] pb-1', className)}
    >
      {children}
    </div>
  )
}
