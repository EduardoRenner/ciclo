import { describe, expect, it } from 'vitest'

import { DESCONTO_CLUBE_BPS, sugerirPlanos, type ClienteParaPrecificacao } from '@/core/loyalty/motor-de-precificacao'

/**
 * CICLO Clube · C-02. O caso que sustenta o arquivo inteiro é o "SÓ O QUE OS DADOS MOSTRAM": se a
 * base não tem ninguém com cadência de 3x/mês, a lista de sugestões não pode ter 3 itens fixos —
 * teria virado "gera sempre 3 planos de exemplo", que é inventar preço do nada.
 */
describe('sugerirPlanos', () => {
  it('base vazia não sugere nada', () => {
    expect(sugerirPlanos([])).toEqual([])
  })

  it('agrupa pela cadência arredondada e precifica pelo ticket MEDIANO do grupo', () => {
    const clientes: ClienteParaPrecificacao[] = [
      { cicloPessoalDias: 28, ticketMedioCents: 5000 }, // ~1x/mês
      { cicloPessoalDias: 30, ticketMedioCents: 6000 }, // ~1x/mês
      { cicloPessoalDias: 32, ticketMedioCents: 7000 }, // ~1x/mês — mediana do grupo é 6000
    ]
    const [plano] = sugerirPlanos(clientes)

    expect(plano!.sessionsPerMonth).toBe(1)
    expect(plano!.clientesNaFaixa).toBe(3)
    // 6000 (mediana) × 1 sessão × 85% (desconto de 15%) = 5100
    expect(plano!.priceCents).toBe(5100)
  })

  it('PISO — cadência que a base não tem não vira sugestão', () => {
    // Só clientes de ~1x/mês. Se o motor "completasse" com 2x e 3x por conta própria, este caso
    // reprovaria — e é exatamente o defeito que este arquivo existe para não ter.
    const clientes: ClienteParaPrecificacao[] = [
      { cicloPessoalDias: 30, ticketMedioCents: 5000 },
      { cicloPessoalDias: 31, ticketMedioCents: 5000 },
    ]
    const sugestoes = sugerirPlanos(clientes)

    expect(sugestoes).toHaveLength(1)
    expect(sugestoes[0]!.sessionsPerMonth).toBe(1)
  })

  it('no máximo 3 faixas, as de mais evidência primeiro, mas listadas em ordem crescente', () => {
    const clientes: ClienteParaPrecificacao[] = [
      // 1x/mês: 5 clientes (maior evidência)
      ...Array.from({ length: 5 }, () => ({ cicloPessoalDias: 30, ticketMedioCents: 5000 })),
      // 2x/mês: 3 clientes
      ...Array.from({ length: 3 }, () => ({ cicloPessoalDias: 15, ticketMedioCents: 5000 })),
      // 4x/mês: 2 clientes
      ...Array.from({ length: 2 }, () => ({ cicloPessoalDias: 7, ticketMedioCents: 5000 })),
      // 8x/mês: 1 cliente — fica de fora, é a 4ª faixa com menos evidência
      { cicloPessoalDias: 4, ticketMedioCents: 5000 },
    ]
    const sugestoes = sugerirPlanos(clientes)

    expect(sugestoes.map((s) => s.sessionsPerMonth)).toEqual([1, 2, 4])
  })

  it('o desconto aplicado é o mesmo que a constante exportada declara', () => {
    // Trava o número contra mudança silenciosa de bps sem atualizar o comentário/decisão.
    expect(DESCONTO_CLUBE_BPS).toBe(1500)
  })
})
