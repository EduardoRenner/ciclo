import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'

/**
 * I-1, `docs/30-INDICACAO-PLANO.md` §4.1. O convite é um link assinado — mesmo HMAC de
 * `token-assinado.ts` que já assina confirmação, avaliação e orçamento — e não uma coluna ou
 * tabela nova: o `id` do lado de dentro é o `client_id` de quem indicou.
 *
 * 180 dias, como o orçamento: é o link mais duradouro, porque a cliente pode guardá-lo no
 * WhatsApp e usá-lo meses depois — diferente de confirmação/avaliação, que morrem com o
 * agendamento que os gerou.
 */
const ESCOPO = 'indicacao'
const VALIDADE_HORAS = 24 * 180

export function gerarTokenIndicacao(clientId: string, segredo?: string): string {
  return gerarTokenAssinado(ESCOPO, clientId, VALIDADE_HORAS, segredo)
}

export function verificarTokenIndicacao(token: string, segredo?: string): string | null {
  return verificarTokenAssinado(ESCOPO, token, segredo)
}
