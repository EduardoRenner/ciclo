import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A seção "O preço não sobe quando você cresce" (`/precos`) é o item C do
 * `docs/43-POSICIONAMENTO-10X.md`, eixo 3 — e é a única página do produto que fala do modelo de
 * negócio de outra gente. Isso pede duas travas que nenhuma outra seção precisa.
 *
 * **1. O contrapeso não pode sumir.** A seção diz que plataforma com comissão fica com uma parte do
 * cliente novo. Isso é verdade e é incompleto: quem cobra comissão entrega uma vitrine que o CICLO
 * não entrega. O parágrafo que admite isso é o que separa comparação de propaganda, e é
 * exatamente o tipo de frase que uma revisão de copy futura corta por "soar negativo" — sem
 * perceber que, sem ele, a seção passa a esconder o que o leitor descobriria em cinco minutos de
 * pesquisa. Vender por omissão neste público é caro: eles conversam entre si.
 *
 * **2. Nenhum número de terceiro.** A pesquisa do `43` tem as taxas medidas, e publicá-las aqui
 * seria uma afirmação sobre preço alheio que envelhece na mão deles e que ninguém daqui reconfere.
 * A comparação é de ESTRUTURA — preço fixo contra percentual — e estrutura não envelhece. Um "20%"
 * colado aqui numa rodada futura vira mentira sem ninguém mexer numa linha.
 */

const PRECOS = 'src/app/(public)/precos/page.tsx'

/**
 * Recorta entre os dois `h2` — delimitador real do elemento, nunca uma janela de N caracteres, que
 * é a armadilha nº 4 da tabela do CLAUDE.md (o vizinho cai dentro da janela e a guarda casa com o
 * texto errado). E comentário fora antes de qualquer casamento: o comentário desta seção explica
 * a regra usando as mesmas palavras que a regra procura.
 */
function secaoDaComparacao(): string {
  const fonte = semComentarios(readFileSync(PRECOS, 'utf8'))
  const inicio = fonte.indexOf('O preço não sobe quando você cresce')
  const fim = fonte.indexOf('Perguntas de dinheiro')
  expect(inicio, 'a seção da comparação de custo sumiu de /precos — item C do docs/43').toBeGreaterThan(-1)
  expect(fim, 'o marcador de fim da seção sumiu — o recorte não pode ser por contagem').toBeGreaterThan(inicio)
  return fonte.slice(inicio, fim)
}

describe('a comparação de custo em /precos é honesta', () => {
  it('admite, na mesma seção, o que o CICLO NÃO entrega', () => {
    const secao = secaoDaComparacao()
    expect(
      /não tem vitrine/.test(secao) && /não traz cliente/.test(secao),
      'o contrapeso saiu: a seção afirma o custo do modelo de comissão sem dizer que quem cobra ' +
        'comissão entrega uma vitrine que o CICLO não entrega. Sem ele, isto vira propaganda.',
    ).toBe(true)
  })

  it('e diz para quem o CICLO não serve, em vez de deixar a pessoa descobrir depois', () => {
    expect(secaoDaComparacao()).toMatch(/marketplace, o CICLO não é isso/)
  })

  it('não publica número de terceiro — nenhum percentual sobre o negócio dos outros', () => {
    const percentuais = secaoDaComparacao().match(/\d+\s*(%|por\s*cento)/g) ?? []
    expect(
      percentuais,
      'apareceu percentual na seção. A comparação é de estrutura, não de taxa: número de ' +
        'concorrente envelhece na mão dele e ninguém daqui reconfere.',
    ).toEqual([])
  })

  it('os valores da tabela vêm da conta, não digitados à mão', () => {
    expect(
      /custoPorAtendimento\(/.test(secaoDaComparacao()),
      'preço digitado na página é preço que diverge do `core/billing/planos` no dia em que o plano ' +
        'mudar — e a tabela que existe para provar uma conta passaria a mostrar outra.',
    ).toBe(true)
  })
})
