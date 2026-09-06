'use client'

import { useEffect, useRef } from 'react'

/**
 * O `h1` de uma tela que SUBSTITUIU outra sem trocar de rota — e que move o foco para si ao
 * aparecer.
 *
 * As quatro páginas que a cliente do salão abre pelo link do WhatsApp (`/confirmar`, `/avaliar`,
 * `/lista-espera`, `/orcamento`) trocam a tela inteira no lugar: escolha → aguarde →
 * sucesso/erro. Medido no navegador em 2026-09-05, no `/confirmar` com token inválido: três
 * conteúdos completamente diferentes, nenhuma troca de rota, e a cada troca
 * `document.activeElement` continuava no `body`, sem `role="alert"` e sem `aria-live` em lugar
 * nenhum. Quem usa leitor de tela tocava em "Vou sim" e não ouvia nada — nem o "aguarde", nem o
 * resultado.
 *
 * É a WCAG 4.1.3 (Status Messages), o mesmo defeito que `504f195` consertou na tela de sucesso do
 * agendamento público. Aqui vira componente em vez de conserto repetido porque esta família já
 * pagou esse preço uma vez: o docstring do `ErroPublico` registra que foi **consertar uma tela por
 * vez** que produziu a divergência que ele existe para desfazer.
 *
 * **Foco, e não `role="status"`.** A região que nasce junto com o conteúdo costuma não ser
 * anunciada — o leitor precisa estar observando o nó antes de o texto mudar, e aqui a tela inteira
 * é montada de uma vez, então não há nó preexistente para observar. Mover o foco anuncia o texto E
 * deixa a pessoa no começo do conteúdo novo, que é onde está o que ela precisa ler.
 *
 * **O caso de foco na CARGA, dito porque é um trade-off real e não um descuido:** em `/avaliar` e
 * `/orcamento` o token é recusado no servidor, então a tela de erro é a PRIMEIRA coisa pintada e
 * este componente move o foco durante a carga. Mover foco ao carregar costuma ser desaconselhado
 * porque atropela o começo da página e pula link de pular navegação — nada disso existe aqui:
 * estas páginas são um cartão só, sem navegação nenhuma em volta, e o título É o começo. O ganho
 * (a pessoa ouve imediatamente que o link não vale e o que fazer) é maior que o custo.
 *
 * Use APENAS em tela que substituiu outra ou que é o conteúdo inteiro da página. Para a tela
 * inicial interativa — "Confirma seu horário?", "Como foi seu atendimento?" — use `<h1>` normal:
 * ali não houve mudança para anunciar, e roubar o foco só atrapalha.
 */
export default function TituloDeEstado({
  children,
  className = 'text-titulo font-bold',
}: {
  children: React.ReactNode
  className?: string
}) {
  const alvo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    alvo.current?.focus()
  }, [])

  /*
   * `tabIndex={-1}` deixa o elemento focável por código sem entrar na ordem do Tab — quem navega
   * por teclado não ganha uma parada extra. E como foco programático não é `:focus-visible`, quem
   * enxerga não vê anel nenhum aparecer.
   */
  return (
    <h1 ref={alvo} tabIndex={-1} className={className}>
      {children}
    </h1>
  )
}
