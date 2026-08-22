export type EventoIcs = {
  /** Instante ISO em UTC, como vem da API de disponibilidade. */
  inicio: string
  fim: string
  titulo: string
  local: string | null
  /** Só compõe o `UID`, que precisa ser estável e único por agendamento. */
  slug: string
  /** Injetado em vez de lido do relógio: função pura não olha as horas (e o teste precisa fixar). */
  agora: string
}

/** `AAAA-MM-DDTHH:MM:SS.sssZ` → `AAAAMMDDTHHMMSSZ`, o formato de data do iCalendar. */
function paraIcs(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * O RFC 5545 exige escapar vírgula, ponto e vírgula e barra invertida dentro do valor —
 * "Corte, barba e sobrancelha" sem isso vira três campos e o evento chega truncado no
 * calendário de quem agendou.
 */
function escapar(texto: string): string {
  return texto.replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

/**
 * Arquivo de calendário do agendamento, montado sem biblioteca — o evento tem cinco campos.
 * Existe porque o funil público terminava no ar: a pessoa marcava, fechava a aba, e o horário
 * só existia na agenda do salão. É assim que nasce um "esqueci que tinha marcado", e falta é o
 * que este produto inteiro existe para evitar.
 */
export function montarIcs(evento: EventoIcs): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CICLO//agendamento//PT-BR',
    'BEGIN:VEVENT',
    `UID:${paraIcs(evento.inicio)}-${evento.slug}@ciclo`,
    `DTSTAMP:${paraIcs(evento.agora)}`,
    `DTSTART:${paraIcs(evento.inicio)}`,
    `DTEND:${paraIcs(evento.fim)}`,
    `SUMMARY:${escapar(evento.titulo)}`,
    ...(evento.local ? [`LOCATION:${escapar(evento.local)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // CRLF não é capricho: o RFC 5545 exige, e o Outlook recusa o arquivo sem.
  return linhas.join('\r\n')
}
