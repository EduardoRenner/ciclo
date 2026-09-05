import { Temporal } from '@js-temporal/polyfill'

export type TipoLembrete = 'confirmation' | 'reminder'

export type LembreteDevido = {
  kind: TipoLembrete
  /** Nome estável usado no dedupe de `messages` (kind + template + appointment_id). */
  template: 'confirmacao_d1' | 'lembrete_d0'
}

const INICIO_JANELA = 8 // 8h — FAQ H109/§7: nada antes disso
const FIM_JANELA = 21 // 21h — nada depois disso

/**
 * O horário "natural" de cada lembrete (§7): confirmação em D-1 18h, lembrete
 * final em D-0 T-3h. Os dois já nascem dentro da janela 8h-21h na imensa
 * maioria dos casos — o clamp existe para o caso em que T-3h cai antes das
 * 8h (agendamento de manhã cedo), onde §7 exige não mandar mensagem de
 * madrugada mesmo que o horário "certo" caísse ali.
 */
function horarioNaturalConfirmacao(diaDoAgendamento: Temporal.PlainDate, timezone: string): Temporal.ZonedDateTime {
  return diaDoAgendamento.subtract({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '18:00' })
}

function horarioNaturalLembrete(inicioAgendamento: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
  const bruto = inicioAgendamento.subtract({ hours: 3 })
  if (bruto.hour < INICIO_JANELA) return bruto.with({ hour: INICIO_JANELA, minute: 0, second: 0, millisecond: 0 })
  if (bruto.hour >= FIM_JANELA) return bruto.with({ hour: FIM_JANELA - 1, minute: 0, second: 0, millisecond: 0 })
  return bruto
}

/**
 * Devolve os lembretes cujo horário de disparo já chegou (`now >= horário`),
 * para o job (rodando a cada 15min, §7) decidir quais mandar agora.
 *
 * **Agendamento marcado em cima da hora devolve os DOIS de uma vez, e isso é
 * deliberado.** O horário natural da confirmação (D-1 18h) está no passado
 * quando alguém marca hoje para hoje, então ele conta como "já chegou" — e o
 * de T-3h também. O texto das duas mensagens carrega a data por extenso
 * (`lembretes.ts`: *"...no dia 10/09 14:00. Responda para confirmar"*), então
 * nenhuma delas fala do dia errado: a primeira é o pedido de confirmação, que
 * é quem leva o link de confirmar, e a segunda é o lembrete. Redundante, não
 * incorreto.
 *
 * A versão anterior deste comentário dizia o contrário — que nesses casos "a
 * lista pode vir vazia". Vinha cheia, e a frase custou um conserto errado que
 * chegou a ser escrito antes de ser medido: suprimir a confirmação depois que
 * o dia chega parece certo até você notar que ela é a mensagem que pede
 * confirmação, e que o caso do job parado (o teste "as duas datas podem estar
 * devidas ao mesmo tempo") existe exatamente para não perdê-la. Está fixado
 * por teste agora — não conserte sem ler `reminders-schedule.test.ts`.
 */
export function lembretesDevidos(
  startsAt: string,
  timezone: string,
  now: string,
): LembreteDevido[] {
  const inicio = Temporal.Instant.from(startsAt).toZonedDateTimeISO(timezone)
  const agora = Temporal.Instant.from(now)
  const dia = inicio.toPlainDate()

  // Agendamento que já começou (ou passou) não tem lembrete a mandar — evita pedido de
  // confirmação e lembrete reaparecendo para um job que ficou parado alguns dias e só voltou a
  // rodar depois do fato. (A redação antiga citava "confirme seu horário de amanhã" como se fosse
  // o texto enviado; não é — `lembretes.ts` manda a data por extenso, nunca a palavra "amanhã".)
  if (Temporal.Instant.compare(agora, inicio.toInstant()) >= 0) return []

  const devidos: LembreteDevido[] = []

  const horaConfirmacao = horarioNaturalConfirmacao(dia, timezone)
  if (Temporal.ZonedDateTime.compare(horaConfirmacao, inicio) < 0 && Temporal.Instant.compare(horaConfirmacao.toInstant(), agora) <= 0) {
    devidos.push({ kind: 'confirmation', template: 'confirmacao_d1' })
  }

  const horaLembrete = horarioNaturalLembrete(inicio)
  if (Temporal.ZonedDateTime.compare(horaLembrete, inicio) < 0 && Temporal.Instant.compare(horaLembrete.toInstant(), agora) <= 0) {
    devidos.push({ kind: 'reminder', template: 'lembrete_d0' })
  }

  return devidos
}
