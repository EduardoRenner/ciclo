import { describe, expect, it } from 'vitest'

import { comRegrasConfirmadas, IDS_CONFIRMAVEIS, REGRAS_CONFIRMAVEIS, regrasConfirmadas } from '@/core/advocacia/configuracao'
import { calcularPrazo } from '@/core/advocacia/prazo-calculo'

describe('regras confirmáveis', () => {
  it('a publicação já é validada na origem; as de rito e a suspensão dependem da direção', () => {
    expect(REGRAS_CONFIRMAVEIS.find((r) => r.id === 'publicacao-diario')?.jaValidada).toBe(true)
    expect(IDS_CONFIRMAVEIS).toEqual(expect.arrayContaining(['unidade-civel', 'unidade-trabalhista', 'unidade-jec', 'unidade-penal', 'suspensao-fim-de-ano']))
    expect(IDS_CONFIRMAVEIS).not.toContain('publicacao-diario')
  })

  it('os ids confirmados destravam o cálculo de verdade (a lista não é decorativa)', () => {
    const base = { disponibilizadoEm: '2026-10-06', dias: 15, rito: 'civel' as const, emDobro: false, naoContaveis: [] }
    expect(calcularPrazo({ ...base, confirmadas: [] }).podePreencher).toBe(false)
    expect(calcularPrazo({ ...base, confirmadas: IDS_CONFIRMAVEIS }).podePreencher).toBe(true)
  })
})

describe('settings', () => {
  it('grava sem apagar outras chaves e ignora id desconhecido', () => {
    const novo = comRegrasConfirmadas({ site: { cor: 'x' }, advocacia: { recuo: 2 } }, ['unidade-civel', 'inventada', 'unidade-civel'])
    expect(novo).toEqual({ site: { cor: 'x' }, advocacia: { recuo: 2, regras_confirmadas: ['unidade-civel'] } })
  })

  it('lê de forma tolerante', () => {
    expect(regrasConfirmadas(null)).toEqual([])
    expect(regrasConfirmadas({ advocacia: { regras_confirmadas: ['unidade-civel', 3, 'x'] } })).toEqual(['unidade-civel'])
  })
})
