import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Os sete nomes da escala de `03-DESIGN-SYSTEM §2`. Precisam estar aqui, e não
 * só no `@theme` do `globals.css`, por um motivo que custou caro para achar: o
 * `tailwind-merge` só conhece a escala padrão do Tailwind (`text-xs`…`text-9xl`).
 * Diante de `text-corpo` ele não tem como saber se é tamanho ou cor, e chuta
 * **cor** — então qualquer `text-txt-2`/`text-acc-2` que venha depois na mesma
 * chamada de `cn()` apagava o tamanho da fonte. O efeito era a interface inteira
 * caindo para o tamanho de corpo herdado, com a hierarquia certa no CSS e errada
 * na tela. Há teste em `tests/unit/design/cn.test.ts`.
 */
const ESCALA = ['numero', 'titulo', 'stat', 'corpo', 'secundario', 'label', 'overline'] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...ESCALA] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
