/** Literal de `02-API §4` — `sendTemplate`/`sendText`/`parseWebhook`. */

export type EnvioTemplate = {
  to: string
  template: string
  params: Record<string, string>
  buttons?: { id: string; label: string }[]
}

export type EnvioTexto = {
  to: string
  body: string
}

export type MensagemRecebida = { kind: 'inbound'; from: string; body: string; receivedAt: string }
export type AtualizacaoDeStatus = {
  kind: 'status'
  providerId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  error?: string
}
export type EventoWebhook = MensagemRecebida | AtualizacaoDeStatus

export interface MessagingProvider {
  sendTemplate(i: EnvioTemplate): Promise<{ providerId: string }>
  /** Só dentro da janela de 24h após a cliente escrever (H107) — quem chama garante isso, não o provider. */
  sendText(i: EnvioTexto): Promise<{ providerId: string }>
  /** Lança se a assinatura for inválida — nunca processa payload de webhook não autenticado. */
  parseWebhook(raw: string, signature: string): EventoWebhook
}

/** Erro específico de falha de envio — `enviarComFallback` decide o que fazer olhando `motivo`. */
export class ErroDeEnvio extends Error {
  readonly motivo: 'template_rejeitado' | 'falha_transitoria'
  constructor(message: string, motivo: 'template_rejeitado' | 'falha_transitoria') {
    super(message)
    this.name = 'ErroDeEnvio'
    this.motivo = motivo
  }
}
