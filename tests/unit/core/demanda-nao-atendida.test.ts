import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { classificarDemanda } from '@/core/agenda/demanda-nao-atendida'

const HOJE = Temporal.PlainDate.from('2026-09-29')
const base = { haviaHorario: false, profissionaisOnline: 2, algumExpediente: true, dia: HOJE.add({ days: 4 }), hoje: HOJE, maxAdvanceDays: 30 }

describe('classificarDemanda', () => {
  it('havia horário: não é demanda não atendida', () => {
    expect(classificarDemanda({ ...base, haviaHorario: true })).toBeNull()
  })

  it('dia sem expediente é "dia_fechado" — o dado do "e se eu abrir sábado?"', () => {
    expect(classificarDemanda({ ...base, algumExpediente: false })).toBe('dia_fechado')
  })

  it('expediente cheio é "sem_vaga"', () => {
    expect(classificarDemanda(base)).toBe('sem_vaga')
  })

  it('ninguém aceita online: é configuração, e o motivo diz isso', () => {
    expect(classificarDemanda({ ...base, profissionaisOnline: 0, algumExpediente: false })).toBe('sem_profissional')
  })

  it('fora da janela da casa (passado ou além do limite) não é demanda', () => {
    expect(classificarDemanda({ ...base, dia: HOJE.subtract({ days: 1 }) })).toBeNull()
    expect(classificarDemanda({ ...base, dia: HOJE.add({ days: 31 }) })).toBeNull()
    expect(classificarDemanda({ ...base, dia: HOJE.add({ days: 30 }) })).toBe('sem_vaga')
    expect(classificarDemanda({ ...base, dia: HOJE })).toBe('sem_vaga')
  })
})
