import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * O botão que abre o assistente pode ser arrastado e encaixa na lateral. Esta guarda protege as
 * quatro decisões que fazem isso funcionar — e cada uma delas, se cair sozinha, produz um defeito
 * diferente e nada avisa.
 *
 * **Por que existe.** O botão vive fixo no canto inferior direito, acima da tab bar, e num painel
 * que é lista (Hoje, Clientes, Agenda) ele cobre exatamente o canto onde ficam conteúdo e ação. A
 * recomendação de UX para assistente flutuante é explícita: *o botão precisa ser movível quando
 * cobre um botão importante*. Antes, a única saída era rolar a página para tirar o que estava
 * embaixo dele.
 *
 * Medido no navegador em 2026-09-03, numa página temporária de `/dev` (o botão só monta com
 * credencial e só existe dentro do `/admin`, que é atrás de login): arrastar de x=303 para a
 * esquerda encaixou em x=16, manteve o Y, ficou dentro da tela, persistiu, e sobreviveu ao
 * recarregar e ao `resize`. E o toque continuou abrindo o painel sem mover o botão.
 */

const ARQUIVO = 'src/components/shell/assistente-flutuante.tsx'
const FONTE = semComentarios(readFileSync(ARQUIVO, 'utf8'))

describe('o leitor deste teste', () => {
  it('leu o componente — não passa por não ter achado nada', () => {
    expect(FONTE.length, `${ARQUIVO} veio vazio`).toBeGreaterThan(2000)
    expect(FONTE).toContain('usePosicaoDoBotao')
  })
})

describe('arrastar o botão não pode brigar com tocar nele', () => {
  it('existe um limiar de movimento antes de virar arrasto', () => {
    /*
     * A decisão mais fácil de perder numa refatoração, e a que mais dói: sem limiar, o tremor
     * natural do dedo vira arrasto, o `click` não dispara, e o botão passa a ser um alvo que às
     * vezes simplesmente não responde. Defeito intermitente, o pior tipo de reclamação.
     */
    expect(/LIMIAR_DE_ARRASTO_PX/.test(FONTE), 'sumiu o limiar que separa toque de arrasto').toBe(true)
    expect(/Math\.hypot\(/.test(FONTE), 'a distância percorrida não é mais medida').toBe(true)
  })

  it('o arrasto engole o clique, para soltar em outro canto não abrir o painel', () => {
    expect(
      /if \(aoSoltar\(e\)\) e\.preventDefault\(\)/.test(FONTE),
      'soltar o botão depois de arrastar voltou a abrir o assistente',
    ).toBe(true)
  })
})

describe('o botão não pode escapar da tela nem do dedo', () => {
  it('`touch-none` está na classe: sem isso o navegador rola a página em vez de arrastar', () => {
    expect(/touch-none/.test(FONTE), 'sem `touch-action: none`, o arrasto vira rolagem e o botão foge do dedo').toBe(true)
  })

  it('a posição é limitada aos limites da tela', () => {
    // Sem limitar, uma posição guardada em tela grande deixa o botão fora do alcance na tela
    // pequena — e não há como trazê-lo de volta, porque o que traz de volta é o próprio botão.
    expect(/Math\.min\(Math\.max\(/.test(FONTE), 'sumiu o travamento dentro dos limites da tela').toBe(true)
  })

  it('girar o aparelho recalcula a posição', () => {
    expect(/addEventListener\('resize'/.test(FONTE), 'girar a tela pode deixar o botão fora dela').toBe(true)
  })
})

describe('o que fica guardado, e onde', () => {
  it('a posição vive no dispositivo, não na conta', () => {
    // É preferência de mão e de tela, não configuração de negócio: não vai para o banco.
    expect(/localStorage\.setItem\(CHAVE_POSICAO_BOTAO/.test(FONTE)).toBe(true)
    expect(/localStorage\.getItem\(CHAVE_POSICAO_BOTAO/.test(FONTE)).toBe(true)
  })

  it('armazenamento bloqueado não derruba o botão', () => {
    /*
     * Aba anônima e navegador com armazenamento bloqueado fazem `localStorage` LANÇAR, não devolver
     * null. Sem `try`, o componente inteiro quebra e o assistente some — trocar uma conveniência
     * por um recurso é o pior negócio possível.
     */
    const usos = FONTE.split('localStorage').length - 1
    const tentativas = FONTE.split('try {').length - 1
    expect(usos, 'nenhum uso de localStorage encontrado — o detector quebrou').toBeGreaterThanOrEqual(2)
    expect(tentativas, 'algum acesso a localStorage ficou sem try/catch').toBeGreaterThanOrEqual(2)
  })
})
