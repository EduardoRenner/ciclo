import { cn } from '@/lib/utils'

type Props = {
  /** Fora da tela quando `false`, sem desmontar — a saída também precisa ser animada. */
  visivel?: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Barra de ação flutuante, ancorada acima da tab bar. `§3.2` manda a ação
 * primária ficar no terço inferior da tela, e é justamente o que não acontecia
 * em "Recuperar receita": o botão "Avisar N selecionadas" nascia acima da
 * lista e sumia do campo de visão no primeiro rolar — a pessoa seleciona sete
 * clientes e perde o botão que age sobre elas.
 *
 * A altura da tab bar (`--tabbar-h`) vem do próprio shell, não de um número
 * repetido aqui: quando a barra mudou de 82 para 64px, todo `pb-[96px]` solto
 * pelo app ficou errado de uma vez.
 */
export default function ActionBar({ visivel = true, children, className }: Props) {
  return (
    <div
      aria-hidden={!visivel}
      // `inert` tira a barra escondida do foco do teclado e do leitor de tela —
      // `opacity-0` sozinho deixa um botão invisível e ainda alcançável por Tab.
      inert={!visivel}
      className={cn(
        'fixed inset-x-0 z-30 mx-auto w-full max-w-[560px] px-[var(--gutter)]',
        'bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+12px)]',
        'transition duration-[var(--dur-2)] ease-[var(--ease-ios)]',
        visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0',
        className,
      )}
    >
      <div className="rounded-[var(--radius)] border border-line-2 bg-surface/95 p-2.5 shadow-flutuante backdrop-blur-xl">
        {children}
      </div>
    </div>
  )
}
