import { describe, expect, it } from 'vitest'

import { EsquemaSite, lerSite } from '@/server/services/site'

/**
 * docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T3 + teste 6 de §8): a cor do site
 * público deixou de vir de `vertical_packs.accent_color` (fixa por profissão)
 * e passa a ser `tenants.settings.site.accent`, escolha do dono. Este arquivo
 * garante que `lerSite` nunca devolve nada além de hex válido ou `null` — o
 * chamador (`public-booking.ts`) resolve `null` para osso; nunca deve haver
 * um terceiro caminho que produza outra cor por acidente.
 */
describe('lerSite — accent', () => {
  it('settings sem site nenhum: accent é ausente (site nasce osso)', () => {
    // `zod.nullish()` sobre objeto vazio produz `undefined`, não `null` — o
    // contrato real é o de `public-booking.ts`: `site.accent ?? OSSO`, e `??`
    // trata os dois igual. É esse contrato que o teste prova, não o valor
    // interno exato.
    expect(lerSite(null).accent ?? null).toBeNull()
    expect(lerSite({}).accent ?? null).toBeNull()
    expect(lerSite({ site: {} }).accent ?? null).toBeNull()
  })

  it('accent hexadecimal válido passa direto', () => {
    expect(lerSite({ site: { accent: '#f59e0b' } }).accent).toBe('#f59e0b')
  })

  it('accent maiúsculo também é aceito (regex é case-insensitive)', () => {
    expect(lerSite({ site: { accent: '#F59E0B' } }).accent).toBe('#F59E0B')
  })

  it('accent com formato inválido nunca vira cor de nicho ou string solta — cai no vazio', () => {
    for (const invalido of ['purple', 'a855f7', '#a855f', '#gggggg', 'rgb(168,85,247)', '']) {
      const resultado = lerSite({ site: { accent: invalido } })
      // `null` aqui é o contrato: o chamador resolve para osso. Nunca deve
      // sobreviver um valor que não seja hex de 6 dígitos.
      expect(resultado.accent, invalido).toBeNull()
    }
  })

  it('site inteiro corrompido (não é objeto) não lança — cai em tudo vazio, accent incluso', () => {
    expect(() => lerSite({ site: 'isto não é um objeto' })).not.toThrow()
    expect(lerSite({ site: 'isto não é um objeto' }).accent).toBeNull()
    expect(() => lerSite('settings inteiro corrompido')).not.toThrow()
  })
})

describe('EsquemaSite — validação de escrita (PATCH /api/v1/tenant)', () => {
  it('aceita accent ausente, null, ou hex válido', () => {
    expect(EsquemaSite.safeParse({}).success).toBe(true)
    expect(EsquemaSite.safeParse({ accent: null }).success).toBe(true)
    expect(EsquemaSite.safeParse({ accent: '#10b981' }).success).toBe(true)
  })

  it('recusa hex malformado com mensagem em português, antes de chegar no banco', () => {
    const resultado = EsquemaSite.safeParse({ accent: 'não é uma cor' })
    expect(resultado.success).toBe(false)
    if (!resultado.success) {
      expect(resultado.error.issues.some((i) => i.path.includes('accent'))).toBe(true)
    }
  })
})
