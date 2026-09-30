import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { entender } from '@/core/inteligencia/entender'
import { sinalSemResposta, TEMAS } from '@/core/inteligencia/medir'

/**
 * MI-7 (docs/85 §5): o que o Motor não respondeu vira contagem — motivo e tema de lista fechada.
 * O teste mais importante é o último: a frase que o Motor não entende é a que ninguém filtrou, e
 * dado de saúde em analytics é a regra 9. Nenhuma palavra da pergunta pode sair no sinal.
 */
const HOJE = Temporal.PlainDate.from('2026-09-29')
const sinal = (t: string, fora = false) => sinalSemResposta(entender(t, HOJE), t, fora)

describe('sinalSemResposta', () => {
  it('pergunta entendida não é sinal — mesmo a que pede um dado a mais', () => {
    expect(sinal('quem sumiu?')).toBeNull()
    expect(sinal('marca a Joana amanhã')).toBeNull()
  })

  it('cada motivo', () => {
    expect(sinal('qual a capital da França?')).toEqual({ motivo: 'nao_entendi', tema: 'outro' })
    expect(sinal('quanto faturei e quanto sobrou?')).toEqual({ motivo: 'ambiguo' })
    // "Por que caiu?" é respondido desde o MI-5: não é mais motivo de aprender.
    expect(sinal('por que o faturamento caiu?')).toBeNull()
    // "E se...?" é respondido desde o MI-6, e o dia extra desde que a procura em dia fechado é gravada.
    expect(sinal('e se eu aumentar o corte pra R$ 60?')).toBeNull()
    expect(sinal('e se eu abrir sábado?')).toBeNull()
    expect(sinal('quanto faturei este mês?', true)).toEqual({ motivo: 'fora_do_alcance', intencao: 'faturamento' })
  })

  it('os pedidos que nenhuma ferramenta atende caem no tema certo — é a fila do próximo ticket', () => {
    expect(sinal('desmarca a Joana')?.tema).toBe('cancelar_ou_remarcar')
    expect(sinal('cancela o horário da Bia')?.tema).toBe('cancelar_ou_remarcar')
    expect(sinal('quanto custa o corte')?.tema).toBe('preco_de_servico')
    expect(sinal('quem faz aniversário essa semana')?.tema).toBe('aniversario')
    expect(sinal('manda um lembrete pra todo mundo')?.tema).toBe('mandar_mensagem')
    expect(sinal('qual serviço mais vende')?.tema).toBe('servico_mais_vendido')
    expect(sinal('quantos clientes eu tenho')?.tema).toBe('contagem_de_clientes')
    expect(sinal('qual dia da semana é mais fraco')).toEqual({ motivo: 'ainda_nao_sei', tema: 'comparar_dias' })
  })

  it('NADA da pergunta sai no sinal: nem nome, nem dado de saúde — só valores de lista fechada', () => {
    const frase = 'a Joana Prado teve reação alérgica à amônia na coloração?'
    const s = sinal(frase)
    expect(s).not.toBeNull()
    const serializado = JSON.stringify(s)
    for (const palavra of ['joana', 'prado', 'reac', 'alerg', 'amonia', 'coloracao']) {
      expect(serializado.toLowerCase(), `"${palavra}" vazou para o evento`).not.toContain(palavra)
    }
    expect(Object.keys(s!).every((k) => ['motivo', 'tema', 'intencao'].includes(k))).toBe(true)
    expect(TEMAS).toContain(s!.tema)
  })
})
