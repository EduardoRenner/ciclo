import { describe, expect, it } from 'vitest'

import { EsquemaExpediente } from '@/server/services/expediente'

const BASE = { professionalId: null as string | null }

describe('EsquemaExpediente', () => {
  it('aceita dois intervalos no mesmo dia sem se tocar', () => {
    const r = EsquemaExpediente.safeParse({
      ...BASE,
      blocos: [
        { weekday: 1, opensAt: '09:00', closesAt: '12:00' },
        { weekday: 1, opensAt: '14:00', closesAt: '19:00' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('recusa intervalos do mesmo dia que se sobrepõem', () => {
    const r = EsquemaExpediente.safeParse({
      ...BASE,
      blocos: [
        { weekday: 1, opensAt: '09:00', closesAt: '13:00' },
        { weekday: 1, opensAt: '12:00', closesAt: '18:00' },
      ],
    })
    expect(r.success).toBe(false)
  })

  it('intervalos encostados (um termina onde o outro começa) são aceitos', () => {
    const r = EsquemaExpediente.safeParse({
      ...BASE,
      blocos: [
        { weekday: 1, opensAt: '09:00', closesAt: '13:00' },
        { weekday: 1, opensAt: '13:00', closesAt: '18:00' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('mesmo horário em dias diferentes não conta como sobreposição', () => {
    const r = EsquemaExpediente.safeParse({
      ...BASE,
      blocos: [
        { weekday: 1, opensAt: '09:00', closesAt: '18:00' },
        { weekday: 2, opensAt: '09:00', closesAt: '18:00' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('recusa fechar antes de abrir', () => {
    const r = EsquemaExpediente.safeParse({ ...BASE, blocos: [{ weekday: 1, opensAt: '18:00', closesAt: '09:00' }] })
    expect(r.success).toBe(false)
  })

  it('recusa horário fora do formato HH:MM', () => {
    const r = EsquemaExpediente.safeParse({ ...BASE, blocos: [{ weekday: 1, opensAt: '9:00', closesAt: '18:00' }] })
    expect(r.success).toBe(false)
  })

  it('lista vazia é válida — apagar o expediente inteiro', () => {
    const r = EsquemaExpediente.safeParse({ ...BASE, blocos: [] })
    expect(r.success).toBe(true)
  })

  it('professionalId aceita uuid ou null, nunca undefined implícito', () => {
    expect(EsquemaExpediente.safeParse({ blocos: [] }).success).toBe(false)
  })
})
