import { cn } from '@/lib/utils'

type Props = {
  nome: string
  /** `md` na lista, `lg` na ficha. */
  tamanho?: 'sm' | 'md' | 'lg'
  className?: string
}

const TAMANHO = {
  sm: 'size-8 text-label',
  md: 'size-11 text-corpo',
  lg: 'size-16 text-stat',
} as const

/** Iniciais: "Maria Clara Souza" → "MC". Nome de uma palavra fica com uma letra só, nunca com duas do mesmo pedaço. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0]!.charAt(0).toUpperCase()
  return (partes[0]!.charAt(0) + partes[partes.length - 1]!.charAt(0)).toUpperCase()
}

/**
 * Matiz derivado do nome, não sorteado: a mesma cliente precisa ter a mesma cor
 * toda vez que a lista recarrega, inclusive entre o servidor e o cliente (um
 * `Math.random()` aqui daria erro de hidratação além de bagunçar a memória
 * visual de quem usa).
 */
function matiz(nome: string): number {
  let soma = 0
  for (let i = 0; i < nome.length; i += 1) soma = (soma * 31 + nome.charCodeAt(i)) % 360
  return soma
}

/**
 * Âncora visual da linha de cliente. Uma lista de 200 nomes em texto igual não
 * tem onde o olho pousar — é o motivo de todo aplicativo de contatos ter isto.
 * Saturação e luminosidade fixas mantêm todos os avatares no mesmo peso do tema
 * escuro; só o matiz varia.
 */
export default function Avatar({ nome, tamanho = 'md', className }: Props) {
  const h = matiz(nome)

  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-[var(--radius-pill)] font-bold',
        TAMANHO[tamanho],
        className,
      )}
      style={{ background: `hsl(${h} 55% 22%)`, color: `hsl(${h} 85% 78%)` }}
    >
      {iniciais(nome)}
    </span>
  )
}
