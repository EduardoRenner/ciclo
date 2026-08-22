import { describe, expect, it } from 'vitest'

import { montarIcs } from '@/core/scheduling/ics'

const BASE = {
  inicio: '2026-08-24T13:00:00.000Z',
  fim: '2026-08-24T13:40:00.000Z',
  titulo: 'Corte — Barbearia Dom Rocha',
  local: 'Rua Augusta, 1442 — Consolação, São Paulo/SP',
  slug: 'dom-rocha',
  agora: '2026-08-22T00:00:00.000Z',
}

describe('montarIcs', () => {
  it('usa o formato de instante do iCalendar, sem hífen, dois-pontos nem milissegundo', () => {
    const ics = montarIcs(BASE)
    expect(ics).toContain('DTSTART:20260824T130000Z')
    expect(ics).toContain('DTEND:20260824T134000Z')
    expect(ics).toContain('DTSTAMP:20260822T000000Z')
  })

  it('separa as linhas com CRLF — o Outlook recusa o arquivo sem', () => {
    expect(montarIcs(BASE).split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
    expect(montarIcs(BASE)).not.toMatch(/[^\r]\n/)
  })

  it('escapa a vírgula do endereço, que senão vira campo novo e trunca o evento', () => {
    const ics = montarIcs(BASE)
    expect(ics).toContain('LOCATION:Rua Augusta\\, 1442 — Consolação\\, São Paulo/SP')
  })

  it('salão sem endereço cadastrado sai sem a linha, não com uma linha vazia', () => {
    const ics = montarIcs({ ...BASE, local: null })
    expect(ics).not.toContain('LOCATION')
  })

  it('o UID é estável para o mesmo horário e muda com ele', () => {
    expect(montarIcs(BASE)).toContain('UID:20260824T130000Z-dom-rocha@ciclo')
    expect(montarIcs({ ...BASE, inicio: '2026-08-24T14:00:00.000Z' })).toContain('UID:20260824T140000Z-dom-rocha@ciclo')
  })
})
