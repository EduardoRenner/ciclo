import { describe, expect, it } from 'vitest'

import { FERRAMENTAS, paraJsonSchema } from '@/server/assistente/ferramentas'

/**
 * "Número nunca vem do modelo" é a regra §0 do `docs/26`. Em preço ela deixa de ser estilo e vira
 * dinheiro: `unitPriceCents` é OPCIONAL em `EsquemaItemComanda` — omitido, o serviço lê o catálogo;
 * preenchido, ele cobra o que veio no corpo. Se a ferramenta aceitasse preço, um número inventado
 * pelo modelo viraria o valor cobrado da cliente, e o cartão de confirmação mostraria esse mesmo
 * número inventado — o dono conferiria a invenção contra ela mesma e confirmaria.
 *
 * Duas metades, as duas precisam valer: o modelo não pode nem VER o campo (JSON Schema), e não
 * pode CONSEGUIR passar por cima se tentar (o schema Zod tem que descartar).
 */
const CAMPOS_DE_DINHEIRO = ['unitPriceCents', 'priceCents', 'preco', 'precoCents', 'discountCents', 'valor', 'totalCents']

describe('o modelo não escolhe preço', () => {
  const ferramenta = FERRAMENTAS.find((f) => f.nome === 'preparar_item_na_comanda')

  it('a ferramenta de comanda existe', () => {
    expect(ferramenta, 'preparar_item_na_comanda sumiu do catálogo').toBeDefined()
  })

  it('o modelo não enxerga campo de dinheiro nenhum', () => {
    const json = paraJsonSchema(ferramenta!.schema)
    const props = Object.keys((json.properties ?? {}) as Record<string, unknown>)
    // Grita se o schema vier vazio, em vez de passar por não ter o que checar.
    expect(props.length, 'JSON Schema saiu sem propriedades').toBeGreaterThan(0)
    for (const campo of CAMPOS_DE_DINHEIRO) {
      expect(props, `o modelo consegue mandar ${campo}`).not.toContain(campo)
    }
  })

  it('preço mandado por cima é DESCARTADO, não repassado', () => {
    // A defesa em profundidade: mesmo que o modelo invente o campo, ele não chega no corpo.
    const comPreco = ferramenta!.schema.parse({
      cliente: 'Fulana',
      item: 'Shampoo',
      unitPriceCents: 999_99,
      discountCents: 5000,
    }) as Record<string, unknown>

    expect(comPreco.cliente, 'o parse não montou o cenário').toBe('Fulana')
    for (const campo of CAMPOS_DE_DINHEIRO) {
      expect(Object.keys(comPreco), `${campo} atravessou o parse`).not.toContain(campo)
    }
  })
})
