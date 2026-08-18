import { enviarEmailDeFallback } from '@/server/providers/messaging/email'
import { ErroDeEnvio, type MessagingProvider } from '@/server/providers/messaging/types'
import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type Canal = Database['public']['Enums']['message_channel']
type Tipo = Database['public']['Enums']['message_kind']

export type EnviarMensagemEntrada = {
  tenantId: string
  clientId: string
  appointmentId?: string
  kind: Tipo
  template: string
  params: Record<string, string>
  /** Texto simples para o fallback de e-mail — o template do WhatsApp não serve de corpo de e-mail. */
  fallbackSubject: string
  fallbackBody: string
  whatsappTo: string
  emailTo?: string | null
}

const TENTATIVAS_WHATSAPP = 3

/**
 * §4: "se MessagingProvider falhar 3 vezes ou o template for rejeitado, cair
 * para push e, se não houver, e-mail. Nunca deixar o lembrete sumir em
 * silêncio." Push (PWA) não existe ainda — nasce no TICKET-056, com o service
 * worker — então o fallback real hoje é direto para e-mail; a ordem push→
 * e-mail já está escrita aqui para o dia em que o push existir só ligar.
 *
 * Toda tentativa termina gravada em `messages`, sucesso ou falha — é o "nunca
 * sumir em silêncio" virando linha de banco, não só log.
 */
export async function enviarComFallback(
  db: Cliente,
  entrada: EnviarMensagemEntrada,
  provider: MessagingProvider = new WhatsAppCloudProvider(),
): Promise<{ channel: Canal; status: 'sent' | 'failed'; providerId: string | null }> {
  // H110: opt-out bloqueia só marketing. Lembrete/confirmação (transacional)
  // segue até a cliente pedir para parar tudo, não só campanha.
  if (entrada.kind === 'campaign') {
    const { data: cliente, error } = await db.from('clients').select('whatsapp_opt_out').eq('id', entrada.clientId).single()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (cliente.whatsapp_opt_out) {
      return registrar(db, entrada, 'whatsapp', 'failed', null, 'Cliente optou por não receber mensagens.')
    }
  }

  let ultimoErro: unknown
  for (let tentativa = 1; tentativa <= TENTATIVAS_WHATSAPP; tentativa++) {
    try {
      const { providerId } = await provider.sendTemplate({ to: entrada.whatsappTo, template: entrada.template, params: entrada.params })
      return registrar(db, entrada, 'whatsapp', 'sent', providerId, null)
    } catch (erro) {
      ultimoErro = erro
      // Template reprovado pela Meta não melhora tentando de novo — pula
      // direto para o fallback (H108: "se as duas variações falharem").
      if (erro instanceof ErroDeEnvio && erro.motivo === 'template_rejeitado') break
    }
  }

  // Push ainda não existe (TICKET-056). Quando existir, entra aqui antes do
  // e-mail, na mesma ordem que §4 descreve.
  try {
    if (!entrada.emailTo) throw new Error('Cliente sem e-mail cadastrado — nenhum canal de fallback disponível.')
    const { providerId } = await enviarEmailDeFallback({ to: entrada.emailTo, subject: entrada.fallbackSubject, body: entrada.fallbackBody })
    return registrar(db, entrada, 'email', 'sent', providerId, null)
  } catch (erroFallback) {
    const mensagemErro = `WhatsApp: ${erroDeTexto(ultimoErro)} · E-mail: ${erroDeTexto(erroFallback)}`
    return registrar(db, entrada, 'whatsapp', 'failed', null, mensagemErro)
  }
}

function erroDeTexto(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

async function registrar(
  db: Cliente,
  entrada: EnviarMensagemEntrada,
  channel: Canal,
  status: 'sent' | 'failed',
  providerId: string | null,
  error: string | null,
) {
  const { error: erroInsert } = await db.from('messages').insert({
    tenant_id: entrada.tenantId,
    client_id: entrada.clientId,
    appointment_id: entrada.appointmentId ?? null,
    channel,
    kind: entrada.kind,
    template: entrada.template,
    status,
    provider_id: providerId,
    error,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  })

  if (erroInsert) {
    // 23505 = já mandou esse lembrete/confirmação para esse agendamento
    // (`messages_dedupe`, 0001). Não é falha — é a proteção contra mensagem
    // duplicada fazendo o trabalho dela.
    if (erroInsert.code !== '23505') throw new AppError('INTERNAL', { cause: erroInsert })
  }

  return { channel, status, providerId }
}
