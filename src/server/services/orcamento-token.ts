import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'

/**
 * Mesmo mecanismo de confirmacao-token.ts, escopo próprio. A validade do TOKEN (a assinatura
 * HMAC em si) é generosa de propósito — 180 dias — porque quem decide se o orçamento ainda
 * vale é o campo `quotes.valid_until` (docs/09-PLATAFORMA.md §11), checado em
 * `orcamentoExpirado()` no momento do uso. As duas validades são independentes por design: o
 * token não pode expirar antes do prazo que o profissional prometeu ao cliente.
 */
const ESCOPO = 'orcamento'
const VALIDADE_HORAS = 24 * 180

export function gerarTokenOrcamento(quoteId: string, segredo?: string): string {
  return gerarTokenAssinado(ESCOPO, quoteId, VALIDADE_HORAS, segredo)
}

export function verificarTokenOrcamento(token: string, segredo?: string): string | null {
  return verificarTokenAssinado(ESCOPO, token, segredo)
}
