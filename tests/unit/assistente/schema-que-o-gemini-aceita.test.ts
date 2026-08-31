import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { FERRAMENTAS, paraJsonSchema } from '@/server/assistente/ferramentas'

/**
 * Em 2026-08-30 um `z.number().int().positive()` num campo `quantidade` derrubou o assistente
 * INTEIRO em produção. O Gemini recusa a requisição com 400 ao ver uma palavra fora do subconjunto
 * que aceita (`Unknown name "exclusiveMinimum" ... Cannot find field`), e como todas as ferramentas
 * viajam no mesmo `tools[0]`, o 400 levou junto as outras: perguntar "quanto faturei" parou de
 * funcionar por causa de um campo de comanda.
 *
 * Typecheck, lint, 1052 testes e build passaram. Nada disso fala com a API do Gemini. Esta é a
 * guarda que faltava, e ela vale mais que as quatro ferramentas desta rodada.
 */
const ACEITAS = new Set(['type', 'format', 'description', 'nullable', 'enum', 'items', 'properties', 'required', 'minItems', 'maxItems', 'anyOf'])

function chavesDe(no: unknown, dentroDeProperties = false): string[] {
  if (Array.isArray(no)) return no.flatMap((x) => chavesDe(x))
  if (no === null || typeof no !== 'object') return []
  const achadas: string[] = []
  for (const [chave, valor] of Object.entries(no as Record<string, unknown>)) {
    // Dentro de `properties` os nomes são campos da ferramenta, não palavras de schema.
    if (!dentroDeProperties) achadas.push(chave)
    achadas.push(...chavesDe(valor, chave === 'properties'))
  }
  return achadas
}

describe('todo schema de ferramenta é digerível pelo Gemini', () => {
  it('há ferramentas para checar', () => {
    expect(FERRAMENTAS.length).toBeGreaterThan(5)
  })

  for (const f of FERRAMENTAS) {
    it(`${f.nome} não manda palavra que o Gemini recusa`, () => {
      const json = paraJsonSchema(f.schema)
      const proibidas = [...new Set(chavesDe(json))].filter((c) => !ACEITAS.has(c))
      expect(proibidas, `${f.nome} manda ${proibidas.join(', ')} — o Gemini responde 400 e DERRUBA TODAS as ferramentas`).toEqual([])
    })
  }

  it('a limpeza pega palavra aninhada, não só a do primeiro nível', () => {
    // O caso real era aninhado: `properties.quantidade.exclusiveMinimum`. Uma limpeza que só
    // olhasse o topo passaria verde aqui e quebraria em produção do mesmo jeito.
    const aninhado = z.object({ lista: z.array(z.object({ n: z.number().int().positive() })) })
    const json = paraJsonSchema(aninhado)
    const bruto = z.toJSONSchema(aninhado, { target: 'draft-7' })

    // Prova que o cenário FOI montado: sem a limpeza, a palavra está lá.
    expect(JSON.stringify(bruto), 'o Zod parou de emitir exclusiveMinimum — refaça este teste').toContain('exclusiveMinimum')
    expect(JSON.stringify(json)).not.toContain('exclusiveMinimum')
  })
})
