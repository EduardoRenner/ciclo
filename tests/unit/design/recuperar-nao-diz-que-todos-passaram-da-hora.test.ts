import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { estadoPorAtraso } from '@/core/cycle/compute'
import { montarMapaDeVazamento } from '@/core/caixa/mapa-de-vazamento'

import { semComentarios } from '../../helpers/fonte'

/**
 * A lista de "Recuperar receita" (`v_recover_revenue`) traz quatro estados — e um deles, `due`, é
 * quem ainda está ANTES da data de voltar (até 3 dias, `estadoPorAtraso`). Medido em 29/09 com o
 * Studio Bella recalculado: 14 na lista, 3 delas `due`, e a tela Hoje dizia "14 clientes passaram
 * da hora de voltar". O mapa de vazamento, que soma a mesma lista, tinha o mesmo título.
 *
 * "Para chamar de volta" é verdade para os quatro estados, e é o nome do botão que o dono toca.
 */
describe('quem está na lista de recuperar não é chamado todo de "passou da hora"', () => {
  it('o cenário existe: `due` é antes da data e entra na lista', () => {
    // Se a régua mudar e `due` virar "depois da data", esta guarda pode ser revista — e grita aqui.
    expect(estadoPorAtraso(-2)).toBe('due')
    expect(estadoPorAtraso(0)).toBe('due')
  })

  it('a tela Hoje conta "para chamar de volta"', () => {
    const hoje = semComentarios(readFileSync('src/app/admin/hoje/hoje.tsx', 'utf8'))
    // Positivo primeiro: a frase nova está lá (senão a negativa abaixo passaria com o bloco apagado).
    expect(hoje).toMatch(/clientes? para chamar de volta/)
    expect(hoje).not.toMatch(/passaram da hora de voltar|cliente passou da hora de voltar/)
  })

  it('o mapa de vazamento tem o mesmo título', () => {
    const [linha] = montarMapaDeVazamento({ recuperar: { pessoas: 14, lucroCents: 50_000 }, clube: [], servicosAbaixoDoPiso: [], procurasEmDiaFechado: [], diaOcioso: null })
    expect(linha!.chave).toBe('recuperar')
    expect(linha!.titulo).toBe('Clientes para chamar de volta')
  })
})
