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

export function gerarTokenConfirmacao(appointmentId: string): string {
  return gerarTokenAssinado(ESCOPO, appointmentId, VALIDADE_HORAS)
}

export function verificarTokenConfirmacao(token: string): string | null {
  return verificarTokenAssinado(ESCOPO, token)
}
