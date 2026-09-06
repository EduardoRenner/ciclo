import { describe, expect, it } from 'vitest'

import { resumoDoEnvio } from '@/core/ciclo/resumo-do-envio'

/**
 * A frase antiga era uma só, para qualquer coisa que desse errado:
 *
 * > `0 enviada(s), 40 não puderam ser avisadas agora (opt-out ou limite de mensagens).`
 *
 * Ela nomeia duas causas, e nos dois casos mais prováveis nenhuma das duas é a certa — o dono
 * clicando depois das 21h, e a entrega falhando por falta de credencial da Meta. Nos dois ele lê
 * que a base inteira deu opt-out, e nos dois a ação que ele tomaria a seguir é a errada.
 */
describe('o resumo do envio não inventa o motivo', () => {
  it('tudo enviado: a frase simples de sempre', () => {
    expect(resumoDoEnvio(3, [])).toBe('Mensagem enviada para 3 clientes.')
    expect(resumoDoEnvio(1, [])).toBe('Mensagem enviada para 1 cliente.')
  })

  it('fora do horário não vira opt-out — e diz o que fazer', () => {
    const frase = resumoDoEnvio(0, ['fora_de_janela', 'fora_de_janela', 'fora_de_janela'])

    expect(frase).toContain('3 pessoas fora do horário de envio (8h às 21h)')
    expect(frase).toContain('tente de manhã')
    // O defeito medido: a causa que a tela afirmava sem saber.
    expect(frase).not.toContain('opt-out')
    expect(frase).not.toContain('limite de mensagens')
  })

  it('falha de entrega não convida a tentar de novo, porque tentar de novo não resolve', () => {
    const frase = resumoDoEnvio(0, ['falha_de_envio'])

    expect(frase).toContain('1 pessoa não recebeu')
    expect(frase).toContain('tentar de novo agora não resolve')
  })

  it('motivos diferentes aparecem separados, cada um com sua contagem', () => {
    const frase = resumoDoEnvio(2, ['opt_out', 'rate_limited', 'opt_out', 'falha_de_envio'])

    expect(frase).toContain('2 mensagens enviadas.')
    expect(frase).toContain('1 pessoa já recebeu uma mensagem nos últimos 7 dias.')
    expect(frase).toContain('2 pessoas pediram para não receber')
    expect(frase).toContain('1 pessoa não recebeu')
  })

  it('motivo DESCONHECIDO é contado, não descartado — a soma tem que fechar', () => {
    /*
     * O caso que mata esta família de tela: o servidor ganha um motivo novo e a apresentação
     * segue lendo a lista fixa. Contar só o conhecido faria "10 pessoas puladas" virar "3", em
     * silêncio e sem erro nenhum — é exatamente o `cartao-de-confirmacao-em-branco`.
     *
     * A frase genérica não inventa causa, mas a pessoa continua entrando na conta.
     */
    const frase = resumoDoEnvio(0, ['opt_out', 'motivo_que_ainda_nao_existe', 'motivo_que_ainda_nao_existe'])

    expect(frase).toContain('1 pessoa pediu para não receber')
    expect(frase).toContain('2 pessoas não foram avisadas agora.')

    const total = [...frase.matchAll(/(\d+) pessoas?/g)].reduce((s, m) => s + Number(m[1]), 0)
    expect(total).toBe(3)
  })

  it('só motivo desconhecido: ainda diz alguma coisa, nunca sai vazio', () => {
    const frase = resumoDoEnvio(0, ['???'])

    expect(frase).toBe('Nenhuma mensagem enviada. 1 pessoa não foi avisada agora.')
  })
})
