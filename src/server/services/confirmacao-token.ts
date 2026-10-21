import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'

/**
 * TICKET-030: "botão confirma sem login". O link do lembrete precisa
 * funcionar sem sessão — igual a `criarConvite` (TICKET-017), mas mais leve:
 * confirmar um agendamento não precisa de revogação (o link perde a validade
 * sozinho quando o agendamento sai de `pending`, checado no momento do uso,
 * não no token), então não abre tabela nova — é HMAC assinado com
 * `CRON_SECRET` (`token-assinado.ts`, generalizado no TICKET-034 quando a
 * lista de espera precisou do mesmo mecanismo).
 */
const ESCOPO = 'confirmacao_agendamento'
const VALIDADE_HORAS = 72 // cobre folga de sobra além do D-0 T-3h mais tardio

export function gerarTokenConfirmacao(appointmentId: string, segredo?: string): string {
  return gerarTokenAssinado(ESCOPO, appointmentId, VALIDADE_HORAS, segredo)
}

/**
 * docs/114 L-07: o link de remarcar ou cancelar que sai na tela de confirmação, na hora de marcar. O
 * horário pode ser daqui a semanas, e o token do lembrete (72h) venceria antes dele: este vale até um
 * dia depois do horário, nunca menos que as 72h do lembrete. Mesmo escopo, mesma página `/confirmar`.
 */
export function gerarTokenDeGestao(appointmentId: string, startsAt: string, segredo?: string): string {
  const horasAteODiaSeguinte = Math.ceil((Date.parse(startsAt) - Date.now()) / 3_600_000) + 24
  return gerarTokenAssinado(ESCOPO, appointmentId, Math.max(VALIDADE_HORAS, horasAteODiaSeguinte), segredo)
}

export function verificarTokenConfirmacao(token: string, segredo?: string): string | null {
  return verificarTokenAssinado(ESCOPO, token, segredo)
}
