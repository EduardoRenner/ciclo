import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

/**
 * A minuta dos Termos (item 3) e da Política (§2) promete: "as perguntas que você faz ao assistente
 * não são enviadas a nenhum serviço de inteligência artificial de terceiros". É uma promessa que o
 * produto cumpre desde o Motor de Inteligência (docs/85), e é do tipo que mais vale e mais se perde
 * em silêncio: o `gemini.ts` continua no repositório, e ligá-lo de volta é UMA linha numa rota.
 *
 * A guarda casa com o que muda quando a promessa quebra: a ROTA do assistente instanciar o provedor
 * externo, ou QUALQUER arquivo (fora o do próprio provedor) importá-lo. Não casa com o nome solto do
 * provedor, que aparece na lista de operadores (documentando que está desligado) e em comentários.
 */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return arquivos(caminho)
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : []
  })
}

const FONTE = arquivos('src').map((c) => ({ caminho: c.replace(/\\/g, '/'), texto: semComentarios(readFileSync(c, 'utf8')) }))
const ROTA = FONTE.find((f) => f.caminho === 'src/app/api/v1/assistant/route.ts')

describe('o assistente não envia nada a IA de terceiros', () => {
  it('o detector enxerga o cenário: acha a rota do assistente e o arquivo do provedor externo', () => {
    expect(ROTA, 'a rota do assistente mudou de lugar: reescreva a guarda').toBeDefined()
    expect(FONTE.some((f) => f.caminho === 'src/server/providers/ai/gemini.ts'), 'o provedor externo sumiu: tire a guarda e a promessa').toBe(true)
  })

  it('a rota instancia o Motor de Inteligência do próprio CICLO', () => {
    expect(ROTA!.texto).toMatch(/provider:\s*new MotorDeConversa\(/)
  })

  it('a rota NÃO instancia nem importa o provedor externo', () => {
    expect(ROTA!.texto, 'a rota voltou a instanciar o provedor de IA de terceiros').not.toMatch(/new GeminiProvider\(/)
    expect(ROTA!.texto).not.toMatch(/providers\/ai\/gemini/)
  })

  it('nenhum outro arquivo importa o provedor externo (só ele mesmo o define)', () => {
    const usos = FONTE.filter((f) => f.caminho !== 'src/server/providers/ai/gemini.ts' && /from ['"][^'"]*providers\/ai\/gemini['"]|import\(['"][^'"]*providers\/ai\/gemini['"]\)/.test(f.texto))
    expect(usos.map((u) => u.caminho), 'alguém importou o provedor de IA de terceiros').toEqual([])
  })

  it('o provedor externo não é escolhido por variável de ambiente em lugar nenhum fora dele', () => {
    const escolhas = FONTE.filter((f) => f.caminho !== 'src/server/providers/ai/gemini.ts' && /process\.env\.AI_PROVIDER|process\.env\.AI_API_KEY/.test(f.texto))
    expect(escolhas.map((u) => u.caminho), 'AI_PROVIDER/AI_API_KEY passou a decidir algo: a promessa de "sem IA de terceiros" depende de uma variável').toEqual([])
  })
})
