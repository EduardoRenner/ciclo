import { describe, expect, it } from 'vitest'

import {
  decidirRampa,
  FASES_COM_LISTA_DE_TENANTS,
  lerFaseDaRampa,
  lerTenantsDaRampa,
  ORCAMENTO_GLOBAL_POR_FASE,
  type FaseDaRampa,
} from '@/core/messaging/rampa-whatsapp'

/** Rampa do número (`docs/74`). O que importa aqui é que NENHUM valor estranho vire "sem limite". */
describe('lerFaseDaRampa', () => {
  it('ausente ou vazio é fase 0, sem acusar valor inválido (é o padrão, não um erro)', () => {
    expect(lerFaseDaRampa(undefined)).toEqual({ fase: 0, valorInvalido: false })
    expect(lerFaseDaRampa('')).toEqual({ fase: 0, valorInvalido: false })
    expect(lerFaseDaRampa('   ')).toEqual({ fase: 0, valorInvalido: false })
  })

  it.each(['0', '1', '2', '3', '4'])('a fase %s é lida como está', (bruto) => {
    expect(lerFaseDaRampa(bruto)).toEqual({ fase: Number(bruto), valorInvalido: false })
  })

  it('tolera espaço ao redor', () => {
    expect(lerFaseDaRampa(' 3 ')).toEqual({ fase: 3, valorInvalido: false })
  })

  // Falha FECHADA: erro de digitação na variável de ambiente nunca abre o automático.
  it.each(['5', '9', '-1', 'abc', '2.5', '1,0', '01', 'quatro', 'true'])('valor "%s" vira fase 0 e é sinalizado', (bruto) => {
    expect(lerFaseDaRampa(bruto)).toEqual({ fase: 0, valorInvalido: true })
  })
})

describe('lerTenantsDaRampa', () => {
  it('separa por vírgula, tira espaço e ignora entradas vazias', () => {
    expect(lerTenantsDaRampa(' a , b,,c ,')).toEqual(new Set(['a', 'b', 'c']))
  })

  it('ausente ou vazio é lista vazia', () => {
    expect(lerTenantsDaRampa(undefined).size).toBe(0)
    expect(lerTenantsDaRampa('').size).toBe(0)
    expect(lerTenantsDaRampa(' , ,').size).toBe(0)
  })
})

describe('decidirRampa', () => {
  const t = 'tenant-a'
  const lista = new Set([t])
  const vazia = new Set<string>()

  it('fase 0 barra todo mundo, mesmo tenant na lista', () => {
    for (const categoria of ['campanha', 'transacional'] as const) {
      expect(decidirRampa({ fase: 0, tenantId: t, tenantsDaRampa: lista, categoria })).toEqual({ permitido: false, motivo: 'fase_0' })
    }
  })

  it.each([1, 2] as const)('fase %s: tenant fora da lista é barrado, mesmo com orçamento sobrando', (fase) => {
    expect(decidirRampa({ fase, tenantId: 'outro', tenantsDaRampa: lista, categoria: 'campanha' })).toEqual({
      permitido: false,
      motivo: 'tenant_fora_da_fase',
    })
  })

  it.each([1, 2] as const)('fase %s: lista vazia não libera ninguém (esquecer a lista é falha fechada)', (fase) => {
    expect(decidirRampa({ fase, tenantId: t, tenantsDaRampa: vazia, categoria: 'transacional' })).toEqual({
      permitido: false,
      motivo: 'tenant_fora_da_fase',
    })
  })

  it.each([1, 2] as const)('fase %s: tenant na lista passa com o orçamento da fase, por categoria', (fase) => {
    expect(decidirRampa({ fase, tenantId: t, tenantsDaRampa: lista, categoria: 'campanha' })).toEqual({
      permitido: true,
      orcamentoDiario: ORCAMENTO_GLOBAL_POR_FASE[fase].campanha,
    })
    expect(decidirRampa({ fase, tenantId: t, tenantsDaRampa: lista, categoria: 'transacional' })).toEqual({
      permitido: true,
      orcamentoDiario: ORCAMENTO_GLOBAL_POR_FASE[fase].transacional,
    })
  })

  it('fase 3: a lista deixa de valer, todo tenant passa, ainda com orçamento global', () => {
    expect(decidirRampa({ fase: 3, tenantId: 'qualquer', tenantsDaRampa: vazia, categoria: 'campanha' })).toEqual({
      permitido: true,
      orcamentoDiario: ORCAMENTO_GLOBAL_POR_FASE[3].campanha,
    })
  })

  it('fase 4: sem orçamento global (o teto por tenant vira a única defesa)', () => {
    expect(decidirRampa({ fase: 4, tenantId: 'qualquer', tenantsDaRampa: vazia, categoria: 'campanha' })).toEqual({
      permitido: true,
      orcamentoDiario: null,
    })
  })
})

describe('tabela de orçamento', () => {
  const fasesComOrcamento: FaseDaRampa[] = [1, 2, 3]

  it('cresce de fase em fase (nunca "liga tudo" de uma vez, nunca recua)', () => {
    for (const categoria of ['campanha', 'transacional'] as const) {
      const valores = fasesComOrcamento.map((f) => ORCAMENTO_GLOBAL_POR_FASE[f][categoria] as number)
      for (let i = 1; i < valores.length; i++) expect(valores[i]).toBeGreaterThan(valores[i - 1]!)
    }
  })

  it('a fase 0 é literalmente zero e só a fase 4 é sem limite', () => {
    expect(ORCAMENTO_GLOBAL_POR_FASE[0]).toEqual({ campanha: 0, transacional: 0 })
    expect(ORCAMENTO_GLOBAL_POR_FASE[4]).toEqual({ campanha: null, transacional: null })
    for (const f of fasesComOrcamento) {
      expect(ORCAMENTO_GLOBAL_POR_FASE[f].campanha).toBeGreaterThan(0)
      expect(ORCAMENTO_GLOBAL_POR_FASE[f].transacional).toBeGreaterThan(0)
    }
  })

  it('campanha nunca ganha mais orçamento que o transacional (confirmação de agendamento não fica para trás)', () => {
    for (const f of fasesComOrcamento) {
      expect(ORCAMENTO_GLOBAL_POR_FASE[f].campanha as number).toBeLessThanOrEqual(ORCAMENTO_GLOBAL_POR_FASE[f].transacional as number)
    }
  })

  it('a lista de tenants só vale nas fases 1 e 2', () => {
    expect([...FASES_COM_LISTA_DE_TENANTS]).toEqual([1, 2])
  })
})
