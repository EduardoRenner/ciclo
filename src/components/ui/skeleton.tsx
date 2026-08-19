import { cn } from '@/lib/utils'

type Props = React.ComponentPropsWithoutRef<'div'>

/**
 * §4: toda lista e todo card têm esqueleto; nunca tela branca. `aria-hidden`
 * porque o leitor de tela não deve narrar caixas cinzas — quem anuncia o
 * carregamento é o `aria-busy` da região.
 *
 * O brilho varre da esquerda para a direita em vez de piscar a opacidade
 * (`animate-pulse`): piscar lê como "algo errado", varrer lê como "está vindo".
 * `motion-reduce:` desliga a varredura e deixa a caixa parada — a regra global
 * de `prefers-reduced-motion` já zera a duração, isto só evita o quadro
 * congelado no meio do gradiente.
 */
export default function Skeleton({ className, ...props }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-sm)] bg-surface-2',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-[brilho_1.6s_infinite]',
        'after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)]',
        'motion-reduce:after:hidden',
        className,
      )}
      {...props}
    />
  )
}
