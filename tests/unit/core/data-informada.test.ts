import { describe, expect, it } from 'vitest'

import { lerDataInformada } from '@/core/tempo/data-informada'

/**
 * BL-51 (2026-09-28, medido contra o importador real): toda data brasileira (`15/08/2026`) era
 * descartada em silêncio — só `2026-08-15` passava — e o Motor de Ciclo nascia vazio para quem
 * migrou de planilha. Estes casos são o formato que planilha e export de outro sistema produzem.
 */
describe('lerDataInformada', () => {
  it('lê o formato brasileiro, que é o que toda planilha daqui produz', () => {
    expect(lerDataInformada('15/08/2026')?.toString()).toBe('2026-08-15')
  })

  it('aceita dia e mês com um dígito', () => {
    expect(lerDataInformada('5/8/2026')?.toString()).toBe('2026-08-05')
  })

  it('aceita traço e ponto como separador', () => {
    expect(lerDataInformada('15-08-2026')?.toString()).toBe('2026-08-15')
    expect(lerDataInformada('15.08.2026')?.toString()).toBe('2026-08-15')
  })

  it('ano com dois dígitos vira 20xx', () => {
    expect(lerDataInformada('15/08/26')?.toString()).toBe('2026-08-15')
  })

  it('continua aceitando ISO', () => {
    expect(lerDataInformada('2026-08-15')?.toString()).toBe('2026-08-15')
  })

  it('ignora a hora que o Excel escreve junto da data', () => {
    expect(lerDataInformada('15/08/2026 14:30')?.toString()).toBe('2026-08-15')
    expect(lerDataInformada('2026-08-15T14:30:00')?.toString()).toBe('2026-08-15')
  })

  it('dd/mm é sempre dia-mês (produto pt-BR): 03/04 é 3 de abril, nunca 4 de março', () => {
    expect(lerDataInformada('03/04/2026')?.toString()).toBe('2026-04-03')
  })

  it('recusa data que não existe em vez de "corrigir" para outro dia', () => {
    expect(lerDataInformada('31/02/2026')).toBeNull()
    expect(lerDataInformada('15/13/2026')).toBeNull()
  })

  it('recusa texto que não é data, e vazio', () => {
    expect(lerDataInformada('ontem')).toBeNull()
    expect(lerDataInformada('agosto')).toBeNull()
    expect(lerDataInformada('')).toBeNull()
    expect(lerDataInformada('   ')).toBeNull()
    expect(lerDataInformada(undefined)).toBeNull()
  })
})

describe('instanteDoDiaInformado', () => {
  it('grava meio-dia UTC: o MESMO dia em qualquer fuso do Brasil (meia-noite UTC voltava um dia)', async () => {
    const { instanteDoDiaInformado } = await import('@/core/tempo/data-informada')
    const { Temporal } = await import('@js-temporal/polyfill')
    const inst = instanteDoDiaInformado(Temporal.PlainDate.from('2026-08-15'))
    expect(inst).toBe('2026-08-15T12:00:00Z')
    for (const tz of ['America/Noronha', 'America/Sao_Paulo', 'America/Manaus', 'America/Rio_Branco']) {
      expect(Temporal.Instant.from(inst).toZonedDateTimeISO(tz).toPlainDate().toString(), tz).toBe('2026-08-15')
    }
    // O defeito que motivou: a data pura vira meia-noite UTC = dia 14 em Brasília.
    expect(Temporal.Instant.from('2026-08-15T00:00:00Z').toZonedDateTimeISO('America/Sao_Paulo').toPlainDate().toString()).toBe('2026-08-14')
  })
})
