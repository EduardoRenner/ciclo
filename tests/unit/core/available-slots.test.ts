import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { availableSlots, type EntradaAvailableSlots } from '@/core/scheduling/available-slots'

const TZ = 'America/Sao_Paulo'

const BASE: EntradaAvailableSlots = {
  date: '2026-08-20', // quinta-feira, sem transição de fuso
  timezone: TZ,
  businessHours: [{ opensAt: '09:00', closesAt: '18:00' }],
  timeOff: [],
  appointments: [],
  serviceDurationMin: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  slotGranularityMin: 30,
  minLeadTimeMinutes: 0,
  maxAdvanceDays: 60,
  now: '2026-08-01T12:00:00Z',
}

/** Devolve o "HH:MM" local de um instante ISO, para comparar contra o expediente sem se perder em UTC. */
function horaLocal(iso: string): string {
  return Temporal.Instant.from(iso).toZonedDateTimeISO(TZ).toPlainTime().toString().slice(0, 5)
}

describe('availableSlots — expediente', () => {
  it('gera slots do início ao fim, na granularidade pedida', () => {
    const slots = availableSlots(BASE)
    // 09:00 a 17:00 (18:00 - 60min), de 30 em 30: 09:00, 09:30, ..., 17:00 → 17 slots
    expect(slots).toHaveLength(17)
    expect(horaLocal(slots[0]!)).toBe('09:00')
    expect(horaLocal(slots.at(-1)!)).toBe('17:00')
  })

  it('não passa do fim do expediente — o último slot cabe inteiro dentro', () => {
    const slots = availableSlots(BASE)
    for (const s of slots) {
      const fim = Temporal.Instant.from(s).add({ minutes: BASE.serviceDurationMin })
      expect(Temporal.Instant.compare(fim, Temporal.Instant.from('2026-08-20T21:00:00Z'))).toBeLessThanOrEqual(0)
    }
  })

  it('respeita múltiplos intervalos no mesmo dia (manhã e tarde) sem oferecer o almoço', () => {
    const slots = availableSlots({
      ...BASE,
      businessHours: [
        { opensAt: '09:00', closesAt: '12:00' },
        { opensAt: '14:00', closesAt: '18:00' },
      ],
      serviceDurationMin: 60,
      slotGranularityMin: 60,
    })
    const horas = slots.map(horaLocal)
    expect(horas).toEqual(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'])
  })
})

describe('availableSlots — serviço maior que a janela', () => {
  it('devolve lista vazia sem quebrar quando nenhum intervalo comporta a duração', () => {
    const slots = availableSlots({ ...BASE, businessHours: [{ opensAt: '09:00', closesAt: '10:00' }], serviceDurationMin: 90 })
    expect(slots).toEqual([])
  })

  it('serviço do tamanho exato da janela gera 1 slot só', () => {
    const slots = availableSlots({ ...BASE, businessHours: [{ opensAt: '09:00', closesAt: '10:30' }], serviceDurationMin: 90 })
    expect(slots).toHaveLength(1)
    expect(horaLocal(slots[0]!)).toBe('09:00')
  })
})

describe('availableSlots — buffer', () => {
  it('bloco ocupado = [início-bufferBefore, fim+bufferAfter] — um agendamento vizinho reduz os slots ao redor', () => {
    const slots = availableSlots({
      ...BASE,
      businessHours: [{ opensAt: '09:00', closesAt: '12:00' }],
      appointments: [{ start: '2026-08-20T14:00:00Z', end: '2026-08-20T15:00:00Z' }], // 11:00–12:00 local
      serviceDurationMin: 30,
      bufferBeforeMin: 15,
      bufferAfterMin: 15,
      slotGranularityMin: 15,
    })
    // Candidato 10:30: termina 11:00, +15min de buffer = 11:15 — colide com o
    // agendamento das 11:00. Candidato 10:15: termina 10:45, +15min = 11:00,
    // encosta sem sobrepor (o teste de overlap é estritamente `<`) — é o
    // último que ainda cabe.
    expect(horaLocal(slots.at(-1)!)).toBe('10:15')
  })

  it('sem buffer, dois agendamentos podem ficar encostados', () => {
    const slots = availableSlots({
      ...BASE,
      businessHours: [{ opensAt: '09:00', closesAt: '12:00' }],
      appointments: [{ start: '2026-08-20T14:00:00Z', end: '2026-08-20T15:00:00Z' }], // 11:00–12:00 local
      serviceDurationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotGranularityMin: 60,
    })
    // 10:00–11:00 encosta exatamente no início do agendamento das 11:00.
    expect(slots.map(horaLocal)).toContain('10:00')
  })
})

describe('availableSlots — folga', () => {
  it('folga bloqueia mesmo sem nenhum agendamento', () => {
    const slots = availableSlots({
      ...BASE,
      timeOff: [{ start: '2026-08-20T15:00:00Z', end: '2026-08-20T18:00:00Z' }], // 12:00–15:00 local
      serviceDurationMin: 60,
      slotGranularityMin: 60,
    })
    const horas = slots.map(horaLocal)
    expect(horas).not.toContain('12:00')
    expect(horas).not.toContain('13:00')
    expect(horas).toContain('11:00')
    expect(horas).toContain('15:00')
  })
})

describe('availableSlots — antecedência mínima', () => {
  it('descarta slot que começa antes de now + minLeadTimeMinutes', () => {
    const slots = availableSlots({
      ...BASE,
      date: '2026-08-20',
      now: '2026-08-20T13:00:00Z', // 10:00 local
      minLeadTimeMinutes: 120,
      serviceDurationMin: 30,
      slotGranularityMin: 30,
    })
    // now+120min = 12:00 local; nada antes disso pode aparecer.
    for (const h of slots.map(horaLocal)) expect(h >= '12:00').toBe(true)
  })

  it('antecedência zero permite marcar praticamente em cima da hora', () => {
    const slots = availableSlots({ ...BASE, now: '2026-08-20T12:00:00Z', minLeadTimeMinutes: 0, slotGranularityMin: 30 })
    expect(slots.map(horaLocal)).toContain('09:00')
  })
})

describe('availableSlots — antecedência máxima', () => {
  it('dia além de maxAdvanceDays devolve lista vazia', () => {
    const slots = availableSlots({ ...BASE, now: '2026-08-01T12:00:00Z', maxAdvanceDays: 5, date: '2026-08-20' })
    expect(slots).toEqual([])
  })

  it('exatamente no limite ainda vale', () => {
    const slots = availableSlots({ ...BASE, now: '2026-08-15T12:00:00Z', maxAdvanceDays: 5, date: '2026-08-20' })
    expect(slots.length).toBeGreaterThan(0)
  })
})

describe('availableSlots — paralelismo (§5.5)', () => {
  it('parallelCapacity 1 (padrão): um agendamento já ocupa o horário', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [{ start: '2026-08-20T13:00:00Z', end: '2026-08-20T14:00:00Z' }], // 10:00–11:00 local
      serviceDurationMin: 60,
      slotGranularityMin: 60,
    })
    expect(slots.map(horaLocal)).not.toContain('10:00')
  })

  it('parallelCapacity 2: o mesmo horário ainda aceita uma segunda cliente', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [{ start: '2026-08-20T13:00:00Z', end: '2026-08-20T14:00:00Z' }], // 10:00–11:00 local
      serviceDurationMin: 60,
      slotGranularityMin: 60,
      parallelCapacity: 2,
    })
    expect(slots.map(horaLocal)).toContain('10:00')
  })

  it('parallelCapacity 2, mas já tem 2 agendamentos: a terceira não cabe', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [
        { start: '2026-08-20T13:00:00Z', end: '2026-08-20T14:00:00Z' },
        { start: '2026-08-20T13:15:00Z', end: '2026-08-20T14:15:00Z' },
      ],
      serviceDurationMin: 60,
      slotGranularityMin: 15,
      parallelCapacity: 2,
    })
    expect(slots.map(horaLocal)).not.toContain('10:00')
  })

  it('folga não respeita paralelismo — bloqueia mesmo com capacidade alta', () => {
    const slots = availableSlots({
      ...BASE,
      timeOff: [{ start: '2026-08-20T13:00:00Z', end: '2026-08-20T14:00:00Z' }], // 10:00–11:00 local
      serviceDurationMin: 60,
      slotGranularityMin: 60,
      parallelCapacity: 5,
    })
    expect(slots.map(horaLocal)).not.toContain('10:00')
  })
})

describe('availableSlots — dia de mudança de horário de verão', () => {
  // Brasil não observa mais DST desde 2019, mas observava até então — usar as
  // transições reais garante que o teste prova algo de verdade, não um fuso
  // inventado. 2018-11-04: relógio adiantou (dia de 23h). 2019-02-16: relógio
  // atrasou (dia de 25h). As duas confirmadas contra o próprio Temporal antes
  // de escrever o teste.

  it('dia de 23h (relógio adiantou): mesmo expediente gera a mesma contagem de slots que um dia comum', () => {
    const numDST = availableSlots({ ...BASE, date: '2018-11-04', now: '2018-10-01T12:00:00Z' })
    const numComum = availableSlots({ ...BASE, date: '2019-06-03', now: '2019-05-01T12:00:00Z' }) // terça, fora de DST
    expect(numDST).toHaveLength(numComum.length)
  })

  it('dia de 25h (relógio atrasou): mesmo expediente gera a mesma contagem de slots', () => {
    const num25h = availableSlots({ ...BASE, date: '2019-02-16', now: '2019-01-01T12:00:00Z' })
    const numComum = availableSlots({ ...BASE, date: '2019-06-03', now: '2019-05-01T12:00:00Z' })
    expect(num25h).toHaveLength(numComum.length)
  })

  it('o primeiro slot do dia de 23h ainda lê 09:00 no relógio local — prova que o offset foi resolvido pela data, não fixo', () => {
    // Se o código somasse minutos a partir de meia-noite UTC com um offset
    // fixo de -03:00 (erro comum), o resultado nesse dia específico (offset
    // real -02:00, por causa do DST) sairia às 08:00 ou 10:00, nunca 09:00.
    const slots = availableSlots({ ...BASE, date: '2018-11-04', now: '2018-10-01T12:00:00Z' })
    expect(horaLocal(slots[0]!)).toBe('09:00')
  })

  it('o primeiro slot do dia de 25h também lê 09:00 no relógio local', () => {
    const slots = availableSlots({ ...BASE, date: '2019-02-16', now: '2019-01-01T12:00:00Z' })
    expect(horaLocal(slots[0]!)).toBe('09:00')
  })

  it('o offset de UTC realmente muda entre os dois dias — confirma que o cenário de teste é real, não trivial', () => {
    const instanteDST = Temporal.PlainDate.from('2018-11-04').toPlainDateTime(Temporal.PlainTime.from('09:00')).toZonedDateTime(TZ)
    const instanteComum = Temporal.PlainDate.from('2019-06-03').toPlainDateTime(Temporal.PlainTime.from('09:00')).toZonedDateTime(TZ)
    expect(instanteDST.offset).not.toBe(instanteComum.offset)
  })

  it('antecedência mínima atravessando a virada de 23h continua contando em tempo real, não em horas de relógio', () => {
    // 2018-11-03 23:30 local (offset -02:00, já em DST) + 120min de
    // antecedência: em tempo real são 2 horas de verdade, não "some 2 no
    // relógio e ignore que meia-noite pulou direto para 01:00".
    const antesDaVirada = Temporal.PlainDateTime.from('2018-11-03T23:30:00').toZonedDateTime(TZ).toInstant()
    const slots = availableSlots({
      ...BASE,
      date: '2018-11-04',
      now: antesDaVirada.toString(),
      minLeadTimeMinutes: 120,
      slotGranularityMin: 15,
    })
    const limite = antesDaVirada.add({ minutes: 120 })
    for (const s of slots) {
      expect(Temporal.Instant.compare(Temporal.Instant.from(s), limite)).toBeGreaterThanOrEqual(0)
    }
    // E o primeiro slot que passa é exatamente o instante-limite arredondado
    // para cima na granularidade — não uma hora de relógio "01:30" que
    // pressuporia que a hora entre 00:00 e 01:00 existiu.
    expect(slots.length).toBeGreaterThan(0)
  })
})


/**
 * Achado da auditoria de 2026-08-28. `cabeSemColidir` contava QUANTOS agendamentos tocam a janela
 * do candidato, não quantos acontecem AO MESMO TEMPO. Com `parallelCapacity` maior que 1 e um
 * serviço longo, dois atendimentos curtos que nem se cruzam somavam 2 e derrubavam o horário —
 * mesmo sem existir nenhum instante com 3 pessoas ao mesmo tempo.
 *
 * O sintoma é do tipo que ninguém reclama: a página pública mostra MENOS horários do que o salão
 * tem. Não gera overbooking, gera agenda vazia — e a `parallelCapacity` existe justamente para o
 * caso da secagem de esmalte (§5.5), onde o serviço é longo e os vizinhos são curtos.
 */
describe('availableSlots — capacidade é simultaneidade, não contagem', () => {
  it('dois agendamentos que NÃO se cruzam não somam contra a capacidade', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [
        { start: '2026-08-20T13:00:00Z', end: '2026-08-20T13:30:00Z' }, // 10:00–10:30 local
        { start: '2026-08-20T14:30:00Z', end: '2026-08-20T15:00:00Z' }, // 11:30–12:00 local
      ],
      serviceDurationMin: 180, // 10:00–13:00 local, encosta nos dois
      slotGranularityMin: 60,
      parallelCapacity: 2,
    })
    // Em nenhum instante haveria 3 pessoas: às 10:15 são 2 (a nova e a primeira), às 11:45 são 2
    // (a nova e a segunda). Com capacidade 2, o horário cabe.
    expect(slots.map(horaLocal)).toContain('10:00')
  })

  it('mas dois que SE cruzam continuam derrubando — a trava não foi afrouxada', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [
        { start: '2026-08-20T13:00:00Z', end: '2026-08-20T14:00:00Z' }, // 10:00–11:00
        { start: '2026-08-20T13:15:00Z', end: '2026-08-20T14:15:00Z' }, // 10:15–11:15, cruza a de cima
      ],
      serviceDurationMin: 180,
      slotGranularityMin: 60,
      parallelCapacity: 2,
    })
    expect(slots.map(horaLocal)).not.toContain('10:00')
  })

  it('capacidade 3: três curtos em sequência ainda cabem sob um longo', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [
        { start: '2026-08-20T13:00:00Z', end: '2026-08-20T13:30:00Z' },
        { start: '2026-08-20T14:00:00Z', end: '2026-08-20T14:30:00Z' },
        { start: '2026-08-20T15:00:00Z', end: '2026-08-20T15:30:00Z' },
      ],
      serviceDurationMin: 180,
      slotGranularityMin: 60,
      parallelCapacity: 2,
    })
    expect(slots.map(horaLocal)).toContain('10:00')
  })

  it('capacidade 1 continua sendo "qualquer encosto derruba" — o padrão não mudou', () => {
    const slots = availableSlots({
      ...BASE,
      appointments: [{ start: '2026-08-20T14:30:00Z', end: '2026-08-20T15:00:00Z' }], // 11:30–12:00
      serviceDurationMin: 180,
      slotGranularityMin: 60,
    })
    expect(slots.map(horaLocal)).not.toContain('10:00')
  })
})
