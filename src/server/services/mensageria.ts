import { enviarEmailDeFallback } from '@/server/providers/messaging/email'
import { enviarPush, type PayloadPush } from '@/server/providers/messaging/push'
import { ErroDeEnvio, type MessagingProvider } from '@/server/providers/messaging/types'
import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'
import { AppError } from '@/server/http/errors'
import { inscricoesPushDoCliente, inscricoesPushDoTenant, removerInscricaoPorEndpoint } from '@/server/services/push'

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
 * silêncio."
 *
 * Toda tentativa termina gravada em `messages`, sucesso ou falha — é o "nunca
 * sumir em silêncio" virando linha de banco, não só log.
 */
export async function enviarComFallback(
  db: Cliente,
  entrada: EnviarMensagemEntrada,
  provider: MessagingProvider = new WhatsAppCloudProvider(),
  enviarPushFn: (i: Parameters<typeof enviarPush>[0], p: PayloadPush) => ReturnType<typeof enviarPush> = enviarPush,
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

  // TICKET-056: cai para push antes do e-mail, na ordem que §4 descreve.
  let erroPush: unknown = null
  try {
    const inscricoes = await inscricoesPushDoCliente(db, entrada.tenantId, entrada.clientId)
    if (inscricoes.length === 0) throw new Error('Cliente sem inscrição de push ativa.')

    const payload: PayloadPush = { title: entrada.fallbackSubject, body: entrada.fallbackBody }
    let providerIdPush: string | null = null
    for (const inscricao of inscricoes) {
      try {
        providerIdPush = (await enviarPushFn(inscricao, payload)).providerId
      } catch (erroDoDispositivo) {
        // 404/410 = inscrição morta (navegador desinstalou/revogou). Não adianta
        // insistir nela nas próximas mensagens — apaga.
        if (erroDoDispositivo instanceof ErroDeEnvio && erroDoDispositivo.motivo === 'template_rejeitado') {
          await removerInscricaoPorEndpoint(db, entrada.tenantId, inscricao.endpoint)
        }
      }
    }
    if (!providerIdPush) throw new Error('Nenhum dispositivo recebeu o push.')
    return registrar(db, entrada, 'push', 'sent', providerIdPush, null)
  } catch (erro) {
    erroPush = erro
  }

  try {
    if (!entrada.emailTo) throw new Error('Cliente sem e-mail cadastrado — nenhum canal de fallback disponível.')
    const { providerId } = await enviarEmailDeFallback({ to: entrada.emailTo, subject: entrada.fallbackSubject, body: entrada.fallbackBody })
    return registrar(db, entrada, 'email', 'sent', providerId, null)
  } catch (erroFallback) {
    const mensagemErro = `WhatsApp: ${erroDeTexto(ultimoErro)} · Push: ${erroDeTexto(erroPush)} · E-mail: ${erroDeTexto(erroFallback)}`
    return registrar(db, entrada, 'whatsapp', 'failed', null, mensagemErro)
  }
}

function erroDeTexto(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * `docs/09-PLATAFORMA.md` §4 eixo 3 (modo solicitação). Aviso operacional pra
 * equipe, não mensagem de cliente — por isso não passa por `registrar()`
 * (que exige `client_id`, e este alerta não tem um cliente-destinatário; o
 * destinatário é a própria equipe). Melhor esforço: sem VAPID configurado ou
 * sem ninguém inscrito, retorna `0` em silêncio — igual ao resto do produto
 * quando falta credencial de terceiro (`docs/DECISOES.md`, padrão repetido
 * 3x), nunca trava o fluxo que disparou o aviso.
 */
export async function notificarEquipe(
  db: Cliente,
  tenantId: string,
  payload: PayloadPush,
  enviarPushFn: (i: Parameters<typeof enviarPush>[0], p: PayloadPush) => ReturnType<typeof enviarPush> = enviarPush,
): Promise<{ enviados: number }> {
  const inscricoes = await inscricoesPushDoTenant(db, tenantId)
  let enviados = 0

  for (const inscricao of inscricoes) {
    try {
      await enviarPushFn(inscricao, payload)
      enviados++
    } catch (erro) {
      if (erro instanceof ErroDeEnvio && erro.motivo === 'template_rejeitado') {
        await removerInscricaoPorEndpoint(db, tenantId, inscricao.endpoint)
      }
    }
  }

  return { enviados }
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
