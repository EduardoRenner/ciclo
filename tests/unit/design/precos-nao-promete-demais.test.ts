import { describe, expect, it } from 'vitest'

import { CARTOES } from '@/lib/planos-cartoes'
import { PLANOS, PLANOS_A_VENDA, type PlanoTier } from '@/core/billing/planos'

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

/**
 * ATUALIZADO em 2026-09-30 (docs/87 D2). "O degrau de baixo" era `ORDEM_DOS_PLANOS[i - 1]`, e para o
 * primeiro degrau pago isso era o Grátis. O Grátis deixou de ser vendido (vira a conta pausada) e o
 * Avançado também, então quem a página de preço compara entre si são as duas faixas À VENDA: o
 * Solo não tem degrau de baixo (o Grátis não está no cartão), e o Equipe se compara com o Solo.
 * A regra em si — não vender como novidade o que o degrau abaixo já dava — não mudou.
 */
function degrauAbaixo(tier: PlanoTier): PlanoTier | null {
  const vendidos = PLANOS_A_VENDA as readonly PlanoTier[]
  const i = vendidos.indexOf(tier)
  return i > 0 ? (vendidos[i - 1] as PlanoTier) : null
}

/** O teto de profissionais, com `null` (sem teto) valendo infinito para poder comparar. */
function tetoDeProfissionais(tier: PlanoTier): number {
  return PLANOS[tier].maxProfissionais ?? Number.POSITIVE_INFINITY
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
    //
    // ATUALIZADO em 2026-09-30 (docs/87 D2): "só ele libera" ganhou uma segunda forma. As duas faixas
    // vendem o mesmo produto e diferem só no tamanho da equipe, então a coisa própria do Equipe é um
    // TETO maior de profissionais (`limite`), e não um módulo. O teto anunciado é conferido contra o
    // core no caso seguinte, para a forma nova não virar promessa solta.
    for (const cartao of CARTOES) {
      const abaixo = degrauAbaixo(cartao.tier)
      const proprios = cartao.inclui.filter((i) => {
        if (i.modulo ?? i.capacidade) return true
        return abaixo !== null && i.limite === 'profissionais' && tetoDeProfissionais(cartao.tier) > tetoDeProfissionais(abaixo)
      })
      expect(proprios.length, `o cartão do ${cartao.tier} não anuncia nada que só ele libera`).toBeGreaterThan(0)
    }
  })

  it('todo teto anunciado no cartão é o teto que o core tem', () => {
    const comLimite = CARTOES.flatMap((c) => c.inclui.filter((i) => i.limite).map((i) => ({ tier: c.tier, item: i })))
    // controle: se ninguém anuncia teto, o caso abaixo passaria vazio
    expect(comLimite.length, 'nenhum cartão anuncia teto de profissionais').toBeGreaterThan(0)
    for (const { tier, item } of comLimite) {
      const teto = PLANOS[tier].maxProfissionais
      expect(teto, `o cartão do ${tier} anuncia um teto que o core não tem`).not.toBeNull()
      expect(item.texto, `"${item.texto}" não diz o teto real (${teto})`).toContain(String(teto))
    }
  })
})
