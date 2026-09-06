import { describe, expect, it } from 'vitest'

import { limparParaGemini } from '@/core/assistente/json-schema'

/**
 * O complemento de `schema-que-o-gemini-aceita`, e o motivo de ser um arquivo separado está
 * medido, não suposto.
 *
 * Aquela guarda roda o schema de TODA ferramenta real e reprova palavra fora do subconjunto do
 * Gemini. É a guarda certa para o incidente de 30/08 e ela funciona. O que ela não consegue ver é
 * o que só aparece quando a REGRA da limpeza muda, porque ela só observa o que o Zod emite hoje.
 * Três mutações em `limparParaGemini`, uma por vez, com o resultado das duas guardas:
 *
 * | mutação | `schema-que-o-gemini-aceita` | esta |
 * |---|---|---|
 * | tirar a checagem de `format` (deixando `uuid`, `email` passarem) | **passou** | reprovou |
 * | trocar a lista de permitidos por uma de proibidos | reprovou | reprovou |
 * | limpar também os NOMES dentro de `properties` | **passou** | reprovou |
 *
 * As duas que ela deixa passar têm o mesmo formato do defeito original: `format: "uuid"` é 400 do
 * mesmo jeito que `exclusiveMinimum` (e `z.uuid()` está em uso hoje, em `EsquemaClienteId`), e um
 * parâmetro que some do schema faz o modelo chamar a ferramenta sem ele. Nenhum dos dois aparece
 * enquanto ninguém mexe na limpeza — e mexer na limpeza é justamente o que uma refatoração
 * distraída faz.
 */
describe('a limpeza é uma lista de permitidos, e a regra tem que continuar sendo essa', () => {
  it('palavra que ninguém previu sai — é o que uma lista de proibidos não faz', () => {
    const inventada = { type: 'object', palavraQueNaoExistiaOntem: 42, description: 'fica' }
    expect(limparParaGemini(inventada)).toEqual({ type: 'object', description: 'fica' })
  })

  it('`format` só passa no que o Gemini conhece — `uuid` e `email` são 400 igual', () => {
    expect(limparParaGemini({ type: 'string', format: 'date-time' })).toEqual({ type: 'string', format: 'date-time' })
    for (const fora of ['uuid', 'email', 'int64', 'uri', 'date']) {
      expect(limparParaGemini({ type: 'string', format: fora }), `format ${fora} não pode passar`).toEqual({ type: 'string' })
    }
  })

  /*
   * Dentro de `properties` os nomes são PARÂMETROS da ferramenta, não palavras de schema. Uma
   * limpeza que os trate igual apaga o parâmetro em silêncio: o Gemini aceita o schema, chama a
   * ferramenta sem o campo, e o erro só aparece no Zod do servidor — depois de a pessoa já ter
   * pedido a coisa. Nenhuma ferramenta tem um campo chamado `default` hoje, e é por isso mesmo
   * que só um caso construído à mão pega esta regra.
   */
  it('nome de parâmetro que colide com palavra de schema sobrevive', () => {
    const schema = {
      type: 'object',
      properties: {
        default: { type: 'string', description: 'um parâmetro chamado default' },
        exclusiveMinimum: { type: 'string' },
      },
      required: ['default'],
    }
    const limpo = limparParaGemini(schema) as { properties: Record<string, unknown>; required: string[] }
    expect(Object.keys(limpo.properties).sort()).toEqual(['default', 'exclusiveMinimum'])
    expect(limpo.required).toEqual(['default'])
  })

  it('e o valor embaixo desse nome continua sendo limpo', () => {
    const limpo = limparParaGemini({
      type: 'object',
      properties: { default: { type: 'number', exclusiveMinimum: 0, description: 'fica' } },
    }) as { properties: { default: Record<string, unknown> } }
    expect(limpo.properties.default).toEqual({ type: 'number', description: 'fica' })
  })

  it('limpa dentro de `items` e de `anyOf`, não só no primeiro nível', () => {
    const fundo = {
      type: 'array',
      minItems: 1,
      items: { anyOf: [{ type: 'number', exclusiveMinimum: 0 }, { type: 'string', pattern: '^a' }] },
    }
    expect(limparParaGemini(fundo)).toEqual({
      type: 'array',
      minItems: 1,
      items: { anyOf: [{ type: 'number' }, { type: 'string' }] },
    })
  })
})
