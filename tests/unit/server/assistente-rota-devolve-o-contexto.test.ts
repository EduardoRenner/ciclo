import { describe, expect, it } from 'vitest'

import { corpoDaResposta } from '@/app/api/v1/assistant/route'

/**
 * docs/85 MI-4 — medido no navegador em 29/09: o laço devolvia o `contexto`, a rota montava a
 * resposta com uma lista explícita de campos que não o incluía, e a conversa morria sem erro
 * ("e sexta?" → "não entendi"). Os testes do Motor passavam: eles chamam o laço, não a rota.
 */
describe('a rota do assistente devolve o que a próxima pergunta precisa', () => {
  it('o contexto sai na resposta, intacto', () => {
    const contexto = { intencao: 'ocupacao', trechos: [] }
    expect(corpoDaResposta({ resposta: 'ok', ferramentasUsadas: [], contexto }).contexto).toBe(contexto)
  })

  it('e a lista continua explícita: nem campo a mais nem o `sinal` (MI-7, só para medir) vão para a tela', () => {
    const r = corpoDaResposta({ resposta: 'ok', ferramentasUsadas: ['x'], extra: 'segredo', sinal: { motivo: 'nao_entendi' } } as never)
    expect(Object.keys(r).sort()).toEqual(['contexto', 'ferramentasUsadas', 'proposta', 'resposta', 'sugestoes'])
  })
})
