import { describe, expect, it } from 'vitest'

import { previaDoDinheiro } from '@/core/ingestao/previa-do-dinheiro'

import type { RegistroCanonico } from '@/core/ingestao/esteira'

const pessoa = (nome: string, ultimaVisita: string | null): RegistroCanonico => ({
  linhas: [1],
  nome,
  telefone: null,
  telefonesExtras: [],
  email: null,
  emailSugerido: null,
  nascimento: null,
  ultimaVisita,
  visitas: [],
  observacao: null,
  etiquetas: [],
  genero: null,
  origem: null,
  avisos: [],
})

const CORTE = { priceCents: 5000, cycleDays: 21 }
const HOJE = '2026-10-13'

describe('prévia do dinheiro (CNV-021): a mesma conta que a Hoje soma', () => {
  it('cada estado vale o preço vezes a chance de voltar, arredondado para baixo', () => {
    const p = previaDoDinheiro(
      [
        pessoa('Em dia', '2026-10-01'), // previsto 22/10: em dia, não conta
        pessoa('Na hora', '2026-09-22'), // previsto 13/10: 0 dia, due 0,85
        pessoa('Atrasada', '2026-09-17'), // previsto 08/10: 5 dias, late 0,65
        pessoa('Em risco', '2026-09-02'), // previsto 23/09: 20 dias, at_risk 0,35
        pessoa('Sumida', '2026-08-04'), // previsto 25/08: 49 dias, lost 0,12
        pessoa('Sem data', null),
      ],
      CORTE,
      HOJE,
    )
    expect(p).toMatchObject({ comData: 5, semData: 1, sumidos: 4, valorCents: 4250 + 3250 + 1750 + 600 })
    expect(p.primeiros.map((x) => [x.nome, x.valorCents])).toEqual([
      ['Na hora', 4250],
      ['Atrasada', 3250],
      ['Em risco', 1750],
      ['Sumida', 600],
    ])
  })

  it('"estes 10 primeiro": o corte é pelo valor, e a lista para no limite', () => {
    const muitas = Array.from({ length: 15 }, (_, i) => pessoa(`P${i}`, i < 5 ? '2026-09-17' : '2026-08-04'))
    const p = previaDoDinheiro(muitas, CORTE, HOJE)
    expect(p.sumidos).toBe(15)
    expect(p.primeiros).toHaveLength(10)
    expect(p.primeiros.slice(0, 5).every((x) => x.valorCents === 3250)).toBe(true)
  })

  it('sem nenhuma data, nada a prometer (zero, e a tela diz por quê)', () => {
    expect(previaDoDinheiro([pessoa('A', null)], CORTE, HOJE)).toEqual({ comData: 0, semData: 1, sumidos: 0, valorCents: 0, primeiros: [] })
  })
})
