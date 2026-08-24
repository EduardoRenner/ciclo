import { describe, expect, it } from 'vitest'

import { CARTOES } from '@/app/(public)/precos/cartoes'
import { ORDEM_DOS_PLANOS, PLANOS, type PlanoTier } from '@/core/billing/planos'

/**
 * A página de preço é o único lugar do produto cujo trabalho é prometer. Este teste existe para
 * que ela não prometa mais do que o código libera.
 *
 * O cenário que ele impede é concreto: alguém acrescenta "controle de estoque" à lista do
 * Essencial porque soa bem, o cliente paga R$ 49, descobre que estoque é do Avançado, cancela — e
 * conta para o bairro. Num público que se conhece por ofício, essa é a forma mais cara de perder
 * um cliente de ticket baixo.
 *
 * O contrário também é defeito, e é por isso que a segunda asserção existe: anunciar sob o
 * Avançado algo que o Grátis já dá é enganar para cima, e faz o degrau parecer valer mais do que
 * vale.
 */

function degrauAbaixo(tier: PlanoTier): PlanoTier | null {
  const i = ORDEM_DOS_PLANOS.indexOf(tier)
  return i > 0 ? (ORDEM_DOS_PLANOS[i - 1] as PlanoTier) : null
}

describe('a página de preço não promete o que o código não libera', () => {
  it('todo módulo anunciado num degrau é realmente liberado por ele', () => {
    for (const cartao of CARTOES) {
      for (const item of cartao.inclui) {
        if (!item.modulo) continue
        expect(
          PLANOS[cartao.tier].modulos.includes(item.modulo),
          `o cartão do ${cartao.tier} anuncia "${item.texto}" (${item.modulo}), que esse degrau não libera`,
        ).toBe(true)
      }
    }
  })

  it('toda capacidade anunciada num degrau é realmente liberada por ele', () => {
    for (const cartao of CARTOES) {
      for (const item of cartao.inclui) {
        if (!item.capacidade) continue
        expect(
          PLANOS[cartao.tier].capacidades.includes(item.capacidade),
          `o cartão do ${cartao.tier} anuncia "${item.texto}" (${item.capacidade}), que esse degrau não libera`,
        ).toBe(true)
      }
    }
  })

  it('nenhum degrau pago anuncia como novidade algo que o degrau abaixo já dava', () => {
    for (const cartao of CARTOES) {
      const abaixo = degrauAbaixo(cartao.tier)
      if (!abaixo) continue

      for (const item of cartao.inclui) {
        // "Tudo do Grátis" e afins não têm chave — são resumo do que vem de baixo, não novidade.
        if (item.modulo) {
          expect(
            PLANOS[abaixo].modulos.includes(item.modulo),
            `o cartão do ${cartao.tier} vende "${item.texto}" como novidade, mas o ${abaixo} já dava`,
          ).toBe(false)
        }
        if (item.capacidade) {
          expect(
            PLANOS[abaixo].capacidades.includes(item.capacidade),
            `o cartão do ${cartao.tier} vende "${item.texto}" como novidade, mas o ${abaixo} já dava`,
          ).toBe(false)
        }
      }
    }
  })

  it('todo degrau pago anuncia pelo menos uma coisa que só ele libera', () => {
    // Degrau que não tem nada de próprio para mostrar não deveria existir — é a pergunta que a
    // Fase D do plano manda fazer em cada fronteira: "qual dor específica faz alguém subir?".
    for (const cartao of CARTOES) {
      if (cartao.tier === 'gratis') continue
      const proprios = cartao.inclui.filter((i) => i.modulo ?? i.capacidade)
      expect(proprios.length, `o cartão do ${cartao.tier} não anuncia nada que só ele libera`).toBeGreaterThan(0)
    }
  })
})
