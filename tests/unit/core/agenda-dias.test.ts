import { describe, expect, it } from 'vitest'

import { agoraEmMinutos, diasFechadosDe, hojeNoFuso, primeiroDiaUtil, proximosDias } from '@/core/agenda/dias'

/** APR-109: a regra do primeiro dia do trilho saiu da tela pública para o core, e ganhou o teste que nunca teve. */
describe('primeiro dia útil do trilho', () => {
  // 2026-10-10 é sábado.
  const dias = proximosDias(14, '2026-10-10')
  const segASab = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, closesAt: '19:00' }))

  it('14 dias corridos, inclusive a virada de mês', () => {
    expect(dias[0]).toBe('2026-10-10')
    expect(dias[13]).toBe('2026-10-23')
    expect(proximosDias(3, '2026-10-30')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })

  it('domingo fechado: quem entra no sábado à noite (depois das 19h) abre na segunda, não no domingo', () => {
    const fechados = diasFechadosDe(dias, segASab)
    expect(fechados.has('2026-10-11')).toBe(true)
    expect(primeiroDiaUtil(dias, segASab, fechados, 19 * 60 + 30)).toBe('2026-10-12')
  })

  it('sábado à tarde, com o negócio ainda aberto: hoje mesmo', () => {
    expect(primeiroDiaUtil(dias, segASab, diasFechadosDe(dias, segASab), 15 * 60)).toBe('2026-10-10')
  })

  it('sem expediente cadastrado, nenhum dia é marcado fechado e vale hoje', () => {
    expect(diasFechadosDe(dias, []).size).toBe(0)
    expect(primeiroDiaUtil(dias, [], new Set(), 23 * 60)).toBe('2026-10-10')
  })

  it('hoje e agora no fuso do negócio, não no do processo', () => {
    const instante = new Date('2026-10-13T02:30:00Z')
    expect(hojeNoFuso('America/Sao_Paulo', instante)).toBe('2026-10-12')
    expect(agoraEmMinutos('America/Sao_Paulo', instante)).toBe(23 * 60 + 30)
  })
})
