/**
 * APR-109: as contas de dia do agendar público, puras, para o trilho de dias (`components/agenda`) e o
 * "Marcar" do painel usarem as mesmas. `AAAA-MM-DD` vira data em UTC de propósito: só serve para dizer
 * o dia da semana e o número; o fuso do negócio entra só em `hojeNoFuso` e `agoraEmMinutos`.
 */
export function paraData(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(Date.UTC(ano!, mes! - 1, dia!))
}

export function diaDaSemana(iso: string): number {
  return paraData(iso).getUTCDay()
}

/** `qtd` dias corridos a partir de `primeiro` (AAAA-MM-DD). */
export function proximosDias(qtd: number, primeiro: string): string[] {
  return Array.from({ length: qtd }, (_, i) => {
    const d = paraData(primeiro)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

/** "Hoje" no fuso do negócio, não no do aparelho: às 23h30 em Brasília o servidor em UTC já está em amanhã. */
export function hojeNoFuso(timezone: string, agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(agora)
}

export function agoraEmMinutos(timezone: string, agora: Date = new Date()): number {
  const partes = new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(agora)
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0)
  return valor('hour') * 60 + valor('minute')
}

export function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

export type BlocoDeExpediente = { weekday: number; closesAt: string }

/** Sem expediente cadastrado não dá para afirmar que algum dia está fechado: nenhum recebe a marca. */
export function diasFechadosDe(dias: readonly string[], hours: readonly { weekday: number }[]): Set<string> {
  if (hours.length === 0) return new Set()
  const abertos = new Set(hours.map((h) => h.weekday))
  return new Set(dias.filter((d) => !abertos.has(diaDaSemana(d))))
}

/**
 * Abrir no primeiro dia em que o negócio atende, não em "hoje" seco: numa barbearia fechada domingo
 * e segunda, quem entra no sábado à noite veria "Sem horários livres" antes de qualquer coisa, que
 * lê como "lotado" e não como "hoje não abre". Hoje já fechado também pula. O dia fechado continua no
 * trilho e tocável; só deixa de ser a primeira impressão.
 */
export function primeiroDiaUtil(dias: readonly string[], hours: readonly BlocoDeExpediente[], fechados: ReadonlySet<string>, minutosAgora: number): string {
  const hoje = dias[0]
  const blocosDeHoje = hoje ? hours.filter((h) => h.weekday === diaDaSemana(hoje)) : []
  const jaFechouHoje = blocosDeHoje.length > 0 && blocosDeHoje.every((h) => paraMinutos(h.closesAt) <= minutosAgora)
  const candidatos = jaFechouHoje ? dias.slice(1) : dias
  return candidatos.find((d) => !fechados.has(d)) ?? dias[0] ?? ''
}
