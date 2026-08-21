'use client'

import { usePathname } from 'next/navigation'

/**
 * Continuidade entre telas. O app trocava de rota em corte seco — nenhuma relação visual entre
 * a tela que sai e a que entra —, então a navegação não comunicava hierarquia: abrir a ficha de
 * um cliente (descer um nível) parecia igual a trocar de aba (mover-se de lado).
 *
 * A `key` no `pathname` é o mecanismo inteiro: o React descarta a árvore anterior e monta a
 * nova, então a animação de entrada roda a cada rota sem precisar de biblioteca de transição
 * nem da API experimental de View Transitions.
 *
 * Fica no layout, e não em cada página, por um motivo prático: por página, a animação
 * reiniciaria a cada re-render interno (trocar de aba na ficha, filtrar uma lista), e a tela
 * piscaria a cada interação.
 *
 * `recua-com-sheet` é o outro lado do par: enquanto um sheet está aberto, este mesmo nó recua
 * um pouco (regra em `globals.css`, presa ao `data-scroll-locked` que o Radix põe no `body`).
 */
export default function TransicaoDeTela({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div key={pathname} className="entrada-de-tela recua-com-sheet">
      {children}
    </div>
  )
}
