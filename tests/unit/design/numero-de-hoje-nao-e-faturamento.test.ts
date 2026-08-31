import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Dois numeros de "hoje", vindos de fontes diferentes, e um deles se chamava faturamento.
 *
 *   Hoje  -> soma `appointments.price_cents` dos concluidos: PRECO DE TABELA. Nao enxerga
 *            desconto dado na comanda, item extra lancado nem gorjeta.
 *   Caixa -> soma `tickets.total_cents` das comandas FECHADAS: o dinheiro de verdade.
 *
 * Os dois estao certos para o que medem. O errado era o rotulo do primeiro dizer "Faturado hoje" —
 * num dia com desconto, ele mostra mais do que a pessoa recebeu, e "faturar" em portugues de
 * negocio e o que entrou.
 */
const HOJE = readFileSync('src/app/admin/hoje/hoje.tsx', 'utf8')
const CAIXA = readFileSync('src/app/admin/caixa/caixa.tsx', 'utf8')
const RESUMO = readFileSync('src/server/services/resumo-hoje.ts', 'utf8')

describe('o numero de "hoje" nao se chama faturamento', () => {
  it('o rotulo do heroi da tela Hoje nao promete faturamento', () => {
    const m = HOJE.match(/const ROTULO_DO_ATENDIDO = '([^']+)'/)
    expect(m, 'a constante do rotulo sumiu — se virou string solta, este teste fica cego').not.toBeNull()
    expect(m![1], 'o rotulo voltou a prometer faturamento sobre preco de tabela').not.toMatch(/faturad/i)
  })

  it('o numero continua vindo do agendamento — se mudar a fonte, o rotulo pode mudar junto', () => {
    // Guarda de direcao: se um dia este numero passar a somar comandas, ele PODE voltar a se
    // chamar faturamento. Enquanto somar preco de tabela, nao pode.
    expect(RESUMO).toContain("a.status === 'done'")
    expect(RESUMO).toContain('price_cents')
  })

  it('o caixa continua sendo quem fala de dinheiro que entrou', () => {
    expect(CAIXA, 'o rotulo honesto do caixa sumiu').toContain('Entrou no dia')
  })

  it('as duas telas nao usam o mesmo rotulo para numeros diferentes', () => {
    const rotuloHoje = HOJE.match(/const ROTULO_DO_ATENDIDO = '([^']+)'/)![1]
    expect(CAIXA, 'as duas telas passaram a chamar coisas diferentes pelo mesmo nome').not.toContain(
      'rotulo="' + rotuloHoje + '"',
    )
  })
})
