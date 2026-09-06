import { describe, expect, it } from 'vitest'

import { ehCancelamentoDoUsuario } from '@/core/share/cancelamento'

/**
 * O que este arquivo protege é o botão de compartilhar o link de agendamento — a ação que
 * `compartilhar.tsx` chama de "a que mais vale para uma conta nova", porque mandar o link é o
 * caminho inteiro do produto para quem acabou de entrar.
 *
 * O defeito que ele existe para impedir é a volta do `catch { return }`: com ele, falha real e
 * desistência eram a mesma coisa, e quem caísse numa falha real apertava o botão e não recebia
 * nada — nem o link, nem um erro.
 */
describe('cancelar a folha de compartilhamento não é falha', () => {
  it('reconhece o AbortError que o navegador manda quando a pessoa fecha a folha', () => {
    expect(ehCancelamentoDoUsuario(new DOMException('cancelado', 'AbortError'))).toBe(true)
  })

  it('reconhece o cancelamento mesmo quando não vem como DOMException', () => {
    /*
     * Safari e alguns WebViews rejeitam com um objeto simples. Se a checagem fosse
     * `instanceof DOMException`, o cancelamento cairia na área de transferência e o produto
     * anunciaria "link copiado" para quem acabou de desistir de compartilhar.
     */
    expect(ehCancelamentoDoUsuario({ name: 'AbortError' })).toBe(true)
  })
})

describe('falha de verdade não pode passar por cancelamento', () => {
  /*
   * Cada um destes é um caminho pelo qual `navigator.share` rejeita SEM a pessoa ter desistido. Se
   * qualquer um voltar a ser lido como cancelamento, o botão volta a morrer em silêncio.
   */
  const falhas: readonly [string, unknown][] = [
    ['permissão negada', new DOMException('sem permissão', 'NotAllowedError')],
    ['contexto inseguro / dado inválido', new DOMException('inválido', 'DataError')],
    ['share presente mas inoperante', new TypeError('share is not a function')],
    ['rejeição sem nome nenhum', new Error('quebrou')],
    ['rejeição com string', 'quebrou'],
    ['rejeição nula', null],
    ['rejeição indefinida', undefined],
  ]

  it.each(falhas)('%s cai para a área de transferência', (_rotulo, erro) => {
    expect(ehCancelamentoDoUsuario(erro)).toBe(false)
  })
})
