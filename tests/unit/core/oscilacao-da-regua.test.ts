import { describe, expect, it } from 'vitest'

import { medirOscilacaoDaRegua, type PontoDeRegua } from '@/core/cycle/oscilacao-da-regua'

/**
 * `docs/73` F3/T6: prova se `medirOscilacaoDaRegua` de fato mede o que o `docs/46` Fase 3 pede —
 * a régua saltando entre calibrações — sem confundir isso com volume de linhas.
 */

function ponto(predictedAt: string, defaultCycleDays: number): PontoDeRegua {
  return { predictedAt, defaultCycleDays }
}

describe('medirOscilacaoDaRegua', () => {
  it('lista vazia devolve null — nada para medir', () => {
    expect(medirOscilacaoDaRegua([])).toBeNull()
  })

  it('régua constante: trocas zero, maior salto zero', () => {
    const pontos = [ponto('2026-01-01T03:00:00Z', 21), ponto('2026-01-02T03:00:00Z', 21), ponto('2026-01-03T03:00:00Z', 21)]
    const r = medirOscilacaoDaRegua(pontos)
    expect(r?.trocas).toBe(0)
    expect(r?.maiorSaltoDias).toBe(0)
    expect(r?.valoresDistintos).toBe(1)
    expect(r?.amostras).toBe(3)
  })

  it('várias linhas na MESMA noite com o mesmo valor não contam como troca — comprime antes de medir', () => {
    // Simula uma noite com 5 clientes diferentes do mesmo serviço, todos com a régua de 21 daquela noite.
    const pontos = Array.from({ length: 5 }, (_, i) => ponto(`2026-01-01T03:00:0${i}Z`, 21))
    const r = medirOscilacaoDaRegua(pontos)
    expect(r?.trocas).toBe(0)
    expect(r?.amostras).toBe(5)
    expect(r?.valoresDistintos).toBe(1)
  })

  it('salto de uma calibração para outra é medido corretamente', () => {
    const pontos = [ponto('2026-01-01T03:00:00Z', 21), ponto('2026-02-01T03:00:00Z', 30), ponto('2026-03-01T03:00:00Z', 21)]
    const r = medirOscilacaoDaRegua(pontos)
    expect(r?.trocas).toBe(2)
    expect(r?.maiorSaltoDias).toBe(9) // |30-21| e |21-30|, os dois dão 9
    expect(r?.valoresDistintos).toBe(2)
    expect(r?.menorDias).toBe(21)
    expect(r?.maiorDias).toBe(30)
  })

  it('desordena a entrada de propósito — a função ordena por predictedAt, não confia na ordem de chegada', () => {
    const pontos = [ponto('2026-03-01T03:00:00Z', 21), ponto('2026-01-01T03:00:00Z', 21), ponto('2026-02-01T03:00:00Z', 45)]
    const r = medirOscilacaoDaRegua(pontos)
    // Ordem real no tempo: 21 (jan) → 45 (fev) → 21 (mar). Maior salto = 24, não 24 nem outro
    // número que a ordem de CHEGADA (já ordenada) daria diferente.
    expect(r?.trocas).toBe(2)
    expect(r?.maiorSaltoDias).toBe(24)
  })

  it('um salto grande seguido de vários pequenos: maiorSaltoDias pega o maior, não o último', () => {
    const pontos = [
      ponto('2026-01-01T03:00:00Z', 20),
      ponto('2026-02-01T03:00:00Z', 60), // salto de 40
      ponto('2026-03-01T03:00:00Z', 58), // salto de 2
      ponto('2026-04-01T03:00:00Z', 59), // salto de 1
    ]
    const r = medirOscilacaoDaRegua(pontos)
    expect(r?.maiorSaltoDias).toBe(40)
    expect(r?.trocas).toBe(3)
  })

  it('uma amostra só: sem troca, sem salto, mas amostras=1 fica visível pra quem interpreta', () => {
    const r = medirOscilacaoDaRegua([ponto('2026-01-01T03:00:00Z', 21)])
    expect(r?.amostras).toBe(1)
    expect(r?.trocas).toBe(0)
    expect(r?.valoresDistintos).toBe(1)
  })
})
