import { enviarEmailDeFallback } from '@/server/providers/messaging/email'
import { enviarPush, type PayloadPush } from '@/server/providers/messaging/push'
import { ErroDeEnvio, type MessagingProvider } from '@/server/providers/messaging/types'
import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'
import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { AppError } from '@/server/http/errors'
import { inscricoesPushDoCliente, inscricoesPushDoTenant, removerInscricaoPorEndpoint } from '@/server/services/push'
import { limitador } from '@/server/services/rate-limit'

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

// Tenant de demonstração nunca dispara transporte real. `lembretes.ts` e `campaigns/route.ts`
// já pulam demo no laço deles — mas `notificarProximoDaLista` (cancelar → avisar a lista de
// espera) e `/cycle/recover/send` (botão "avisar" um a um) caem aqui direto. Se o WhatsApp Cloud
// for configurado um dia, um clique numa conta de exemplo mandaria mensagem real para um dos
// telefones inventados do seed. A trava fica no ponto por onde TODO envio passa, não em cada
// chamador — é o mesmo raciocínio de `consertar-a-pergunta-nao-o-caso`. Grava `messages` como
// enviada (a demo mostra histórico de mensagem e precisa parecer viva), só não chama provider.
//
// O `Map` não expira de propósito, e isso foi conferido em vez de suposto: `tenants.slug` não tem
// NENHUM escritor depois do onboarding (`/api/v1/onboarding` grava; `atualizarSite` monta as
// colunas uma a uma e slug não está entre elas; nenhuma migration nem script o altera). Slug
// imutável e chave por tenant = sem envelhecimento e sem crescimento sem teto — ao contrário do
// `Map` do rate limit, cuja chave era por IP. Se um dia o slug virar editável, este cache passa a
// mentir e precisa ser invalidado na escrita.
const slugPorTenant = new Map<string, string>()
async function tenantEhDemonstracao(db: Cliente, tenantId: string): Promise<boolean> {
  let slug = slugPorTenant.get(tenantId)
  if (slug === undefined) {
    const { data, error } = await db.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
    if (error) {
      /*
        Erro de leitura deixa a pergunta SEM resposta, e o `error` era descartado sem nem um log —
        a trava mais silenciosa é a que não sabe que não sabe. As duas saídas custam, e não custam
        igual:

        - falhar ABERTO (o que segue valendo): um tenant de demonstração com blip de rede manda
          WhatsApp de verdade para um telefone inventado do seed — indelicado, e é o defeito que
          este bloco existe para evitar;
        - falhar FECHADO: um tenant DE VERDADE com o mesmo blip tem o lembrete engolido e gravado
          em `messages` como `sent`/`demo-simulado`. A cliente perde o horário e o histórico do
          salão jura que avisou.

        O segundo é a "promessa de canal" que o CLAUDE.md nomeia como o pior defeito desta base, e
        atinge quem paga. Por isso aberto — mas aberto e RUIDOSO, nunca aberto e mudo.
      */
      console.warn(JSON.stringify({ level: 'warn', event: 'demo_indeterminada_enviando_de_verdade', tenantId }), error)
      return false
    }
    slug = data?.slug ?? ''
    // Ausência não entra no cache: `''` é "não sei ainda", não um slug. Guardá-lo congelaria a
    // resposta errada para sempre — inclusive para um tenant criado depois desta leitura.
    if (slug) slugPorTenant.set(tenantId, slug)
  }
  return slug !== '' && ehDemonstracao(slug)
}

// Freio antes do acelerador (F0/item B, `docs/25-ESTRATEGIA-E-EXECUCAO.md`): teto duro de envio
// por tenant por dia. Valor estimado [S] — sem uso real ainda para calibrar; registrado em
// `docs/DECISOES.md`. 'campaign' é marketing (menor); todo o resto é transacional/tempo-sensível
// (reminder, confirmation, transactional, e qualquer kind futuro não listado — falha fechado
// para o teto maior, nunca sem teto).
const TETO_DIARIO_CAMPANHA = 100
const TETO_DIARIO_TRANSACIONAL = 300
const JANELA_TETO_DIARIO_SEGUNDOS = 86_400

export type OpcoesTetoDiario = { limite: number; janelaSegundos: number }

/** Exportado só para o teste medir a janela expirando sem esperar 24h de verdade. */
async function dentroDoTetoDiario(tenantId: string, kind: Tipo, override?: OpcoesTetoDiario): Promise<boolean> {
  const categoria = kind === 'campaign' ? 'campaign' : 'transacional'
  const limite = override?.limite ?? (categoria === 'campaign' ? TETO_DIARIO_CAMPANHA : TETO_DIARIO_TRANSACIONAL)
  const janelaSegundos = override?.janelaSegundos ?? JANELA_TETO_DIARIO_SEGUNDOS
  const { permitido } = await limitador(`mensagens:${categoria}:${tenantId}:dia`, { limite, janelaSegundos })
  return permitido
}

/**
 * §4: "se MessagingProvider falhar 3 vezes ou o template for rejeitado, cair
 * para push e, se não houver, e-mail. Nunca deixar o lembrete sumir em
 * silêncio."
 *
 * Toda tentativa termina gravada em `messages`, sucesso ou falha — é o "nunca
 * sumir em silêncio" virando linha de banco, não só log. Exceção deliberada:
 * bloqueio pelo teto diário (abaixo) NÃO grava — ver comentário no retorno `blocked`.
 */
export async function enviarComFallback(
  db: Cliente,
  entrada: EnviarMensagemEntrada,
  provider: MessagingProvider = new WhatsAppCloudProvider(),
  enviarPushFn: (i: Parameters<typeof enviarPush>[0], p: PayloadPush) => ReturnType<typeof enviarPush> = enviarPush,
  /** Só para teste medir o teto/janela sem esperar 100+ envios reais ou 24h de verdade. */
  tetoDiarioOverride?: OpcoesTetoDiario,
): Promise<{ channel: Canal; status: 'sent' | 'failed' | 'blocked'; providerId: string | null }> {
  if (await tenantEhDemonstracao(db, entrada.tenantId)) {
    return registrar(db, entrada, 'whatsapp', 'sent', 'demo-simulado', null)
  }

  // H110: opt-out bloqueia só marketing. Lembrete/confirmação (transacional)
  // segue até a cliente pedir para parar tudo, não só campanha.
  if (entrada.kind === 'campaign') {
    const { data: cliente, error } = await db.from('clients').select('whatsapp_opt_out').eq('id', entrada.clientId).single()
    if (error) throw new AppError('INTERNAL', { cause: error })
    if (cliente.whatsapp_opt_out) {
      return registrar(db, entrada, 'whatsapp', 'failed', null, 'Cliente optou por não receber mensagens.')
    }
  }

  // Teto diário por tenant, ANTES de qualquer tentativa de transporte e ANTES de `registrar()`.
  // Gravar essa tentativa em `messages` faria `messages_dedupe` marcar o lembrete/confirmação
  // como "já enviado" pra sempre (perda de mensagem, não proteção) e inflaria a taxa de falha
  // que `checarMensagens` monitora (achado do plano — a linha bloqueada não é uma falha real).
  if (!(await dentroDoTetoDiario(entrada.tenantId, entrada.kind, tetoDiarioOverride))) {
    console.warn(
      JSON.stringify({ level: 'warn', event: 'mensagem_bloqueada_teto_diario', tenantId: entrada.tenantId, kind: entrada.kind }),
    )
    return { channel: 'whatsapp', status: 'blocked', providerId: null }
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
    if (!entrada.emailTo) throw new Error('Cliente sem e-mail cadastrado, nenhum canal de fallback disponível.')
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
