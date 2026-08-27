import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { FERRAMENTAS, ferramentasPermitidas, paraJsonSchema } from '@/core/assistente/ferramentas'

/**
 * docs/26-AGENTE-IA-PLANO.md §3/§6 (A8) — parte pura do catálogo, sem I/O: não precisa de
 * Supabase nem de cliente falso.
 */
describe('paraJsonSchema', () => {
  it('remove $schema e additionalProperties — o Gemini rejeita os dois', () => {
    const schema = z.object({ clientId: z.uuid() })
    const json = paraJsonSchema(schema)

    expect(json).not.toHaveProperty('$schema')
    expect(json).not.toHaveProperty('additionalProperties')
    expect(json).toMatchObject({ type: 'object', required: ['clientId'] })
  })
})

describe('ferramentasPermitidas', () => {
  it('owner enxerga todas as ferramentas da Fase A', () => {
    expect(ferramentasPermitidas('owner')).toHaveLength(FERRAMENTAS.length)
  })

  it('professional não enxerga faturamento_do_periodo (report:read não está no papel)', () => {
    const nomes = ferramentasPermitidas('professional').map((f) => f.nome)
    expect(nomes).not.toContain('faturamento_do_periodo')
  })

  it('professional enxerga resumo_de_hoje (appointment:own cobre appointment:read por escopo)', () => {
    const nomes = ferramentasPermitidas('professional').map((f) => f.nome)
    expect(nomes).toContain('resumo_de_hoje')
  })

  it('nenhuma ferramenta da Fase A exige permissão fora do que rbac.ts concede a algum papel — nenhuma fica órfã', () => {
    const todosOsPapeis = ['owner', 'manager', 'professional', 'reception', 'finance'] as const
    for (const f of FERRAMENTAS) {
      const algumPapelAlcanca = todosOsPapeis.some((p) => ferramentasPermitidas(p).some((disponivel) => disponivel.nome === f.nome))
      expect(algumPapelAlcanca, `${f.nome} não é alcançada por nenhum papel — ninguém consegue usar`).toBe(true)
    }
  })
})
