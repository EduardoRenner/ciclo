/**
 * O Gemini NÃO aceita JSON Schema inteiro em `functionDeclarations` — aceita um subconjunto, e
 * recusa a requisição inteira com 400 ao ver uma palavra fora dele. Não é uma propriedade
 * ignorada: é `Unknown name "exclusiveMinimum" ... Cannot find field`, e a chamada morre.
 *
 * Isso derrubou o assistente EM PRODUÇÃO em 2026-08-30, e o jeito como derrubou é a lição: um
 * `z.number().int().positive()` num campo `quantidade` de UMA ferramenta nova gerou
 * `exclusiveMinimum`, e como todas as ferramentas vão no MESMO `tools[0]`, o 400 levou junto
 * todas as outras — perguntar "quanto faturei" parou de funcionar por causa de um campo de
 * comanda. Typecheck, lint, 1052 testes e build: todos verdes.
 *
 * Por isso a defesa é uma LISTA DO QUE PODE, não uma lista do que não pode. Uma lista de proibidos
 * só conhece os erros que já aconteceram; a próxima palavra que o Zod resolver emitir passaria
 * direto e derrubaria tudo de novo. O que não está aqui sai fora, e sair fora é seguro: a palavra
 * perdida afrouxa a descrição para o modelo, e a validação de verdade é o Zod no servidor, que
 * roda depois e não perde nada.
 */
const PERMITIDAS = new Set([
  'type',
  'format',
  'description',
  'nullable',
  'enum',
  'items',
  'properties',
  'required',
  'minItems',
  'maxItems',
  'anyOf',
])

/** `format` fora do que o Gemini conhece também é 400 — só estes dois valem para string. */
const FORMATOS_DE_STRING = new Set(['date-time', 'enum'])

export function limparParaGemini(no: unknown): unknown {
  if (Array.isArray(no)) return no.map(limparParaGemini)
  if (no === null || typeof no !== 'object') return no

  const saida: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(no as Record<string, unknown>)) {
    if (!PERMITIDAS.has(chave)) continue
    if (chave === 'format' && !(typeof valor === 'string' && FORMATOS_DE_STRING.has(valor))) continue
    // `properties` é um mapa de nome→schema: os NOMES são livres, só os valores se limpam.
    if (chave === 'properties' && valor !== null && typeof valor === 'object') {
      const props: Record<string, unknown> = {}
      for (const [nome, sub] of Object.entries(valor as Record<string, unknown>)) props[nome] = limparParaGemini(sub)
      saida[chave] = props
      continue
    }
    saida[chave] = limparParaGemini(valor)
  }
  return saida
}
