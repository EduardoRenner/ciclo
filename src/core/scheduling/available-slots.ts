import { Temporal } from '@js-temporal/polyfill'

/** Expediente de um dia da semana: horário local, sem data (é como `business_hours.opens_at`/`closes_at` chegam do banco). "HH:MM" ou "HH:MM:SS". */
export type IntervaloExpediente = { opensAt: string; closesAt: string }

/** Um intervalo de tempo real — agendamento existente ou folga. ISO instant (UTC), como `timestamptz` chega do banco. */
export type IntervaloOcupado = { start: string; end: string }

export type EntradaAvailableSlots = {
  /** "YYYY-MM-DD" — o dia para o qual calcular os horários. */
  date: string
  /** Fuso do tenant (ex.: "America/Sao_Paulo") — é nele que o expediente em "HH:MM" faz sentido. */
  timezone: string
  businessHours: IntervaloExpediente[]
  timeOff: IntervaloOcupado[]
  appointments: IntervaloOcupado[]
  serviceDurationMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  slotGranularityMin: number
  minLeadTimeMinutes: number
  maxAdvanceDays: number
  /** ISO instant (UTC) — "agora", vem do chamador para o teste poder controlar o tempo. */
  now: string
  /** §5.5: quantos atendimentos simultâneos o serviço aceita (secagem de esmalte etc.). Padrão 1. */
  parallelCapacity?: number
}

/**
 * §5.1, literal. A regra central que evita bug de fuso: o expediente (que
 * chega como "09:00"/"18:00", horário local sem data) vira `Temporal.Instant`
 * **uma vez só**, resolvendo o offset certo para `date` naquele fuso — dia de
 * transição de horário de verão tem offset diferente do resto do ano, e é
 * `ZonedDateTime.toInstant()` que sabe disso, não uma soma de minutos feita à
 * mão. Depois desse único passo, toda a aritmética (buffer, granularidade,
 * antecedência) roda em cima de `Instant`, que não tem noção de "horário
 * local" — não tem como um bug de fuso se esconder ali.
 */
export function availableSlots(input: EntradaAvailableSlots): string[] {
  const {
    date,
    timezone,
    businessHours,
    timeOff,
    appointments,
    serviceDurationMin,
    bufferBeforeMin,
    bufferAfterMin,
    slotGranularityMin,
    minLeadTimeMinutes,
    maxAdvanceDays,
    now,
    parallelCapacity = 1,
  } = input

  const nowInstant = Temporal.Instant.from(now)
  const diaAlvo = Temporal.PlainDate.from(date)

  // Regra 3 (limite superior): "até quando dá pra marcar" é contado em dias de
  // calendário no fuso do tenant, não em horas corridas — reservar às 23h de
  // hoje e às 00h05 de amanhã são o "mesmo dia +1" para a pessoa que agenda.
  const hojeNoFuso = nowInstant.toZonedDateTimeISO(timezone).toPlainDate()
  if (Temporal.PlainDate.compare(diaAlvo, hojeNoFuso.add({ days: maxAdvanceDays })) > 0) return []

  const limiteInferior = nowInstant.add({ minutes: minLeadTimeMinutes })
  const duracao = Temporal.Duration.from({ minutes: serviceDurationMin })

  // Folga (timeOff) nunca tem paralelismo — o profissional está fora, ponto.
  // Só agendamento conta para o teto de `parallelCapacity`.
  const blocosOcupados: BlocoOcupado[] = [
    ...timeOff.map((b) => ({ start: Temporal.Instant.from(b.start), end: Temporal.Instant.from(b.end), contaParaParalelismo: false })),
    ...appointments.map((b) => ({ start: Temporal.Instant.from(b.start), end: Temporal.Instant.from(b.end), contaParaParalelismo: true })),
  ]

  const slots: Temporal.Instant[] = []

  for (const janela of businessHours) {
    const abreInstant = paraInstant(diaAlvo, janela.opensAt, timezone)
    const fechaInstant = paraInstant(diaAlvo, janela.closesAt, timezone)
    if (Temporal.Instant.compare(fechaInstant, abreInstant) <= 0) continue // janela invertida ou vazia, ignora

    let candidato = abreInstant
    while (true) {
      const fimServico = candidato.add(duracao)
      // Regra 2, primeira metade: [início, início+duração] cabe inteiro na
      // janela — sem contar buffer, que é só para o teste de colisão abaixo.
      if (Temporal.Instant.compare(fimServico, fechaInstant) > 0) break

      if (Temporal.Instant.compare(candidato, limiteInferior) >= 0) {
        const blocoInicio = candidato.subtract({ minutes: bufferBeforeMin })
        const blocoFim = fimServico.add({ minutes: bufferAfterMin })

        if (cabeSemColidir(blocoInicio, blocoFim, blocosOcupados, parallelCapacity)) {
          slots.push(candidato)
        }
      }

      candidato = candidato.add({ minutes: slotGranularityMin })
    }
  }

  return slots.map((s) => s.toString())
}

/** Resolve "HH:MM"/"HH:MM:SS" de `dia` em `timezone` para o instante exato — é aqui que o offset de DST entra. */
function paraInstant(dia: Temporal.PlainDate, horaLocal: string, timezone: string): Temporal.Instant {
  const hora = Temporal.PlainTime.from(horaLocal.length === 5 ? `${horaLocal}:00` : horaLocal)
  return dia.toPlainDateTime(hora).toZonedDateTime(timezone).toInstant()
}

type BlocoOcupado = { start: Temporal.Instant; end: Temporal.Instant; contaParaParalelismo: boolean }

function seSobrepoe(aInicio: Temporal.Instant, aFim: Temporal.Instant, bInicio: Temporal.Instant, bFim: Temporal.Instant): boolean {
  return Temporal.Instant.compare(aInicio, bFim) < 0 && Temporal.Instant.compare(bInicio, aFim) < 0
}

/**
 * §5.5: com capacidade N, cabem N atendimentos SIMULTÂNEOS.
 *
 * Auditoria de 2026-08-28: isto contava quantos agendamentos **encostam** na janela do candidato,
 * não quantos acontecem ao mesmo tempo. Com capacidade 2, um serviço de 3 h e dois atendimentos
 * curtos que nem se cruzam (10:00–10:30 e 11:30–12:00) somavam 2 e derrubavam o horário — apesar
 * de em nenhum instante existirem três pessoas. Quanto mais longo o serviço, mais vizinhos ele
 * encosta e mais horário some.
 *
 * O sintoma é do tipo que ninguém reclama: a página pública mostra MENOS horários do que o salão
 * tem. Não gera overbooking, gera agenda vazia — e a capacidade paralela existe justamente para o
 * caso da secagem de esmalte, onde o serviço é longo e os vizinhos são curtos.
 *
 * A conta certa é a de linha de varredura: recorta cada ocupação ao pedaço que cai dentro da
 * janela, ordena os eventos e olha o PICO. Fim antes de início no mesmo instante, porque
 * atendimento que termina 10:30 e outro que começa 10:30 não são simultâneos.
 */
function cabeSemColidir(
  blocoInicio: Temporal.Instant,
  blocoFim: Temporal.Instant,
  ocupados: BlocoOcupado[],
  parallelCapacity: number,
): boolean {
  const eventos: { quando: Temporal.Instant; delta: number }[] = []

  for (const bloco of ocupados) {
    if (!seSobrepoe(blocoInicio, blocoFim, bloco.start, bloco.end)) continue

    // Folga: qualquer sobreposição já derruba o slot, não importa paralelismo.
    if (!bloco.contaParaParalelismo) return false

    const inicio = Temporal.Instant.compare(bloco.start, blocoInicio) > 0 ? bloco.start : blocoInicio
    const fim = Temporal.Instant.compare(bloco.end, blocoFim) < 0 ? bloco.end : blocoFim
    eventos.push({ quando: inicio, delta: 1 }, { quando: fim, delta: -1 })
  }

  eventos.sort((a, b) => {
    const ordem = Temporal.Instant.compare(a.quando, b.quando)
    return ordem !== 0 ? ordem : a.delta - b.delta
  })

  let simultaneos = 0
  for (const evento of eventos) {
    simultaneos += evento.delta
    // Com capacidade N, o (N+1)-ésimo simultâneo é o que não cabe — e o candidato seria ele.
    if (simultaneos >= parallelCapacity) return false
  }

  return true
}
