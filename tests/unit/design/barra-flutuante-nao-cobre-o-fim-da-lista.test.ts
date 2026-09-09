import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A `ActionBar` é `fixed` e flutua sobre o conteúdo. Quem a usa precisa reservar espaço no fim,
 * ou ela cobre a última parte da lista para sempre.
 *
 * MEDIDO em 2026-09-09, a 390px, abrindo a vitrine de componentes: a barra fica em
 * `bottom: var(--tabbar-h) + 12px` e tem **70px de altura própria**, então o topo dela fica a
 * 146px do fundo da tela. O `pb` do layout do admin reserva `var(--tabbar-h) + 28px` = 92px.
 * Sobram ~54px de conteúdo passando por baixo de um cartão quase opaco (`bg-surface/95` com
 * desfoque).
 *
 * `clientes/[id]/ficha.tsx` já tinha topado com isso e resolvido com `pb-20`, deixando o motivo
 * escrito: *"`pb-8` deixava a última linha do histórico escondida atrás da barra"*. Só que o
 * conserto foi para aquele arquivo, e `recuperar/recuperar.tsx` — que é o botão CENTRAL da barra
 * de abas — ficou com o mesmo defeito.
 *
 * É o padrão de `consertar-a-pergunta-nao-o-caso`: o conserto de um caso deixou o irmão dele sem
 * vigia. Esta guarda existe para valer na PRÓXIMA tela que usar a barra, não só nas duas de hoje.
 */

/** `pb-20` (80px) é a folga que `ficha.tsx` mediu e que cobre os ~54px com sobra. */
const FOLGA = /pb-2\d|pb-\[/

function telas(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, entrada.name).split(String.fromCharCode(92)).join('/')
    if (entrada.isDirectory()) achados.push(...telas(caminho))
    else if (entrada.name.endsWith('.tsx')) achados.push(caminho)
  }
  return achados
}

const USAM_A_BARRA = [...telas('src/app/admin'), ...telas('src/components')].filter((a) =>
  semComentarios(readFileSync(a, 'utf8')).includes('<ActionBar'),
)

describe('quem usa a barra flutuante reserva espaço embaixo', () => {
  it('a varredura acha as telas — não passa por não ter olhado nada', () => {
    expect(USAM_A_BARRA.length, 'nenhuma tela usa `<ActionBar` — a varredura cegou').toBeGreaterThan(0)
    // O positivo conhecido: as duas de 2026-09-09. Se uma sair da lista, foi por mudança real.
    expect(USAM_A_BARRA).toContain('src/app/admin/recuperar/recuperar.tsx')
    expect(USAM_A_BARRA).toContain('src/app/admin/clientes/[id]/ficha.tsx')
  })

  it.each(USAM_A_BARRA)('%s dá folga para a lista passar por baixo da barra', (tela) => {
    const fonte = semComentarios(readFileSync(tela, 'utf8'))
    expect(
      FOLGA.test(fonte),
      `${tela} rende uma \`ActionBar\` e não reserva folga no fim. A barra é \`fixed\`, tem 70px ` +
        'de altura e fica acima da tab bar: sem `pb-20` (ou equivalente), os últimos ~54px da ' +
        'lista ficam permanentemente debaixo de um cartão quase opaco.',
    ).toBe(true)
  })

  it('a barra continua sendo o motivo da folga — a conta não mudou', () => {
    /*
     * Piso contra a guarda virar folclore: se a barra deixar de ser `fixed`, ou parar de se
     * ancorar na tab bar, a folga acima vira espaço morto e esta guarda vira cerimônia.
     */
    const barra = semComentarios(readFileSync('src/components/ui/action-bar.tsx', 'utf8'))
    expect(barra, 'a ActionBar deixou de ser fixed — reveja a folga das telas').toContain('fixed')
    expect(barra, 'a ActionBar deixou de se ancorar na tab bar').toContain('var(--tabbar-h)')
  })
})
