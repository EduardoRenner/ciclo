import { describe, expect, it } from 'vitest'

import { ocorrenciaConflitaComFolga, proximasDatas } from '@/core/recurrence/gerar-ocorrencias'

const TETO = 100

describe('proximasDatas · semanal', () => {
  it('toda terça a partir de uma segunda pula pra terça seguinte', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 }, // 2 = terça
      inicio: '2026-08-17', // segunda
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-08-25', '2026-09-01'])
  })

  it('quinzenal (intervaloSemanas 2) pula uma semana inteira entre ocorrências', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 2 },
      inicio: '2026-08-18', // já é terça
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-09-01', '2026-09-15'])
  })

  it('respeita ocorrenciasJaGeradas ao estender uma série existente', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-09-08',
      limite: { tipo: 'numero_de_vezes', total: 5 },
      ocorrenciasJaGeradas: 3, // já rodaram 3 das 5 permitidas
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toHaveLength(2)
  })

  it('para no horizonte de geração mesmo sem fim definido', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-08-18',
      limite: { tipo: 'sem_fim' },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-09-01',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-08-25', '2026-09-01'])
  })

  it('para na data-fim da série mesmo se o horizonte de geração for maior', () => {
    const datas = proximasDatas({
      regra: { tipo: 'semanal', weekday: 2, intervaloSemanas: 1 },
      inicio: '2026-08-18',
      limite: { tipo: 'ate_data', data: '2026-08-25' },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-18', '2026-08-25'])
  })
})

describe('proximasDatas · a_cada_dias', () => {
  it('gera a partir do próprio dia de início, sem procurar weekday', () => {
    const datas = proximasDatas({
      regra: { tipo: 'a_cada_dias', intervaloDias: 15 },
      inicio: '2026-08-01',
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-01', '2026-08-16', '2026-08-31'])
  })
})

describe('proximasDatas · mensal_dia_semana', () => {
  it('primeira segunda do mês', () => {
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 1, ordinal: 1 }, // 1 = segunda
      inicio: '2026-08-01', // sábado
      limite: { tipo: 'numero_de_vezes', total: 3 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    // 1ª segunda de ago/2026 = 03; set/2026 = 07; out/2026 = 05
    expect(datas).toEqual(['2026-08-03', '2026-09-07', '2026-10-05'])
  })

  it('ordinal 5 (última do mês) funciona em mês com só 4 ocorrências do weekday', () => {
    // fevereiro/2027 não é bissexto: só 4 domingos. Confirma que "última" não quebra.
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 0, ordinal: 5 }, // 0 = domingo, "última"
      inicio: '2027-02-01',
      limite: { tipo: 'numero_de_vezes', total: 1 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2027-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2027-02-28'])
  })

  it('ordinal 5 escolhe a 5ª quando o mês realmente tem 5 ocorrências', () => {
    // agosto/2026: sábados caem em 1, 8, 15, 22, 29 — tem 5ª.
    const datas = proximasDatas({
      regra: { tipo: 'mensal_dia_semana', weekday: 6, ordinal: 5 }, // 6 = sábado
      inicio: '2026-08-01',
      limite: { tipo: 'numero_de_vezes', total: 1 },
      ocorrenciasJaGeradas: 0,
      horizonte: '2026-12-31',
      tetoDeSeguranca: TETO,
    })
    expect(datas).toEqual(['2026-08-29'])
  })
})

describe('proximasDatas · teto de segurança', () => {
  it('nunca ultrapassa tetoDeSeguranca mesmo com limite "sem_fim" e horizonte distante', () => {
    const datas = proximasDatas({
      regra: { tipo: 'a_cada_dias', intervaloDias: 1 },
      inicio: '2026-01-01',
      limite: { tipo: 'sem_fim' },
      ocorrenciasJaGeradas: 0,
      horizonte: '2030-12-31',
      tetoDeSeguranca: 10,
    })
    expect(datas).toHaveLength(10)
  })
})

describe('ocorrenciaConflitaComFolga', () => {
  const inicio = '2026-08-18T17:00:00Z'
  const fim = '2026-08-18T18:00:00Z'

  it('detecta sobreposição parcial', () => {
    expect(ocorrenciaConflitaComFolga(inicio, fim, [{ start: '2026-08-18T17:30:00Z', end: '2026-08-18T19:00:00Z' }])).toBe(true)
  })

  it('não detecta quando a folga termina exatamente quando a ocorrência começa', () => {
    expect(ocorrenciaConflitaComFolga(inicio, fim, [{ start: '2026-08-18T16:00:00Z', end: '2026-08-18T17:00:00Z' }])).toBe(false)
  })

  it('não detecta folga em outro dia', () => {
    expect(ocorrenciaConflitaComFolga(inicio, fim, [{ start: '2026-08-19T00:00:00Z', end: '2026-08-19T23:00:00Z' }])).toBe(false)
  })
})
