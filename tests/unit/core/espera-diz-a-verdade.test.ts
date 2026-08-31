import { describe, expect, it } from 'vitest'

import { textoDeEspera } from '@/core/http/espera'
import { AppError } from '@/server/http/errors'

/**
 * Achado por acidente em 2026-08-30, esbarrando no limite do assistente enquanto testava: a
 * resposta dizia "Espere um instante e tente de novo" e o `retryAfterSeconds` no mesmo corpo dizia
 * **86400**. As janelas deste produto vão de 2 segundos a 24 horas e todas recebiam a mesma frase.
 *
 * Mesma classe da mentira do "O endereço não existe": quem lê "um instante" tenta de novo em vinte
 * segundos, tenta em um minuto, e conclui que o produto quebrou — quando ele está funcionando como
 * projetado e só não soube dizer isso.
 */
describe('a frase da espera corresponde à espera', () => {
  it('segundos continuam sendo "um instante"', () => {
    expect(textoDeEspera(2)).toContain('um instante')
    expect(textoDeEspera(60)).toContain('um instante')
  })

  it('minutos dizem quantos minutos', () => {
    expect(textoDeEspera(600)).toContain('10 minutos')
  })

  it('uma hora não é "um instante"', () => {
    const t = textoDeEspera(3600)
    expect(t).not.toContain('um instante')
    expect(t).toContain('uma hora')
  })

  it('VINTE E QUATRO HORAS nunca são "um instante"', () => {
    // O caso medido. Esta é a asserção que existe por causa do defeito real.
    const t = textoDeEspera(86_400)
    expect(t, 'o limite diário está sendo anunciado como "um instante"').not.toContain('um instante')
    expect(t).toContain('limite de uso de hoje')
  })

  it('não promete hora certa no limite diário — a janela é deslizante', () => {
    // Trocar "um instante" por "amanhã às 00h" seria trocar uma frase errada por outra: o crédito
    // volta aos poucos, não à meia-noite.
    expect(textoDeEspera(86_400)).not.toMatch(/amanhã|meia-noite|00h/i)
  })

  it('o erro de verdade carrega a frase certa, não só a função isolada', () => {
    // Sem isto a guarda testaria uma função que ninguém chama — a costura é o que interessa.
    const erro = AppError.limiteDeTaxa(86_400)
    expect(erro.mensagem ?? erro.message, 'o AppError não usa textoDeEspera').toContain('limite de uso de hoje')
  })
})
