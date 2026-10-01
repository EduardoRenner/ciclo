import { describe, expect, it } from 'vitest'

import { EsquemaCliente, EsquemaClienteParcial } from '@/server/services/clientes'

/**
 * A rota de PATCH valida com `EsquemaCliente.partial()`. Campo com `.default(...)` dentro de um
 * schema parcial ainda pode ser PREENCHIDO com o default quando ausente (Zod 4): o corpo
 * `{ notes: 'x' }` viraria `{ notes: 'x', marketingOptIn: false }`, e editar uma observação
 * revogaria em silêncio o consentimento de marketing da cliente. O que este arquivo guarda: o parse
 * de uma edição devolve EXATAMENTE os campos que vieram, nenhum a mais.
 */
describe('EsquemaClienteParcial — editar um campo não inventa outros', () => {
  it('só uma observação: sai só a observação', () => {
    expect(EsquemaClienteParcial.parse({ notes: 'só uma nota' })).toEqual({ notes: 'só uma nota' })
  })

  it('corpo vazio sai vazio', () => {
    expect(EsquemaClienteParcial.parse({})).toEqual({})
  })

  it('o opt-out do WhatsApp e o consentimento de marketing NUNCA aparecem sem terem sido enviados', () => {
    const saida = EsquemaClienteParcial.parse({ name: 'Ana' }) as Record<string, unknown>
    expect(saida).not.toHaveProperty('whatsappOptOut')
    expect(saida).not.toHaveProperty('marketingOptIn')
  })

  it('CONTROLE POSITIVO — a CRIAÇÃO continua aplicando os padrões (sem etiqueta = lista vazia, sem marketing = false)', () => {
    expect(EsquemaCliente.parse({ name: 'Ana' })).toMatchObject({ name: 'Ana', tags: [], marketingOptIn: false })
  })

  it('CONTROLE POSITIVO — o que foi enviado chega', () => {
    expect(EsquemaClienteParcial.parse({ tags: ['vip'], marketingOptIn: true })).toEqual({ tags: ['vip'], marketingOptIn: true })
    // `docs/95` E2.4: o "Não chamar mais" da fila chega, e só ele.
    expect(EsquemaClienteParcial.parse({ whatsappOptOut: true })).toEqual({ whatsappOptOut: true })
  })
})
