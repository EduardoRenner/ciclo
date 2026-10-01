import { Temporal } from '@js-temporal/polyfill'

import { gerarTokenAssinado, verificarTokenAssinado } from '@/server/services/token-assinado'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * `docs/95` E1: o link de agendamento que vai DENTRO da mensagem de volta (botão "Chamar" da tela
 * Recuperar, WhatsApp do próprio dono). Ele leva a pessoa direto ao agendamento do salão, com o
 * serviço já escolhido, e deixa duas marcas na mensagem da chamada (`messages`, migration 0099):
 * quando o link foi aberto e qual agendamento saiu dele. É a atribuição por CLIQUE, que a
 * atribuição por tempo (`core/attribution/compute.ts`) não consegue dar.
 *
 * Mesmo HMAC de `token-assinado.ts` (confirmação, avaliação, orçamento, indicação), escopo próprio
 * (`volta`): um token de outra família nunca é aceito aqui. O `id` carrega tenant, cliente e
 * serviço, e não o id da mensagem, de propósito: o link é montado quando a lista é desenhada, ANTES
 * do toque em "Chamar" criar a mensagem — esperar a resposta do servidor para só então abrir o
 * WhatsApp faz o navegador do celular bloquear a janela nova.
 */
const ESCOPO = 'volta'
/** Validade do link e janela em que uma chamada ainda "é dona" do clique e do agendamento. */
export const DIAS_DO_LINK_DE_VOLTA = 14
const SEPARADOR = '~'

export type AlvoDoLinkDeVolta = { tenantId: string; clientId: string; serviceId: string }

export function gerarTokenDeVolta(alvo: AlvoDoLinkDeVolta, segredo?: string): string {
  const id = [alvo.tenantId, alvo.clientId, alvo.serviceId].join(SEPARADOR)
  return gerarTokenAssinado(ESCOPO, id, DIAS_DO_LINK_DE_VOLTA * 24, segredo)
}

export function lerTokenDeVolta(token: string | null | undefined, segredo?: string): AlvoDoLinkDeVolta | null {
  if (!token) return null
  const id = verificarTokenAssinado(ESCOPO, token, segredo)
  if (!id) return null
  const partes = id.split(SEPARADOR)
  if (partes.length !== 3 || partes.some((p) => p.length === 0)) return null
  const [tenantId, clientId, serviceId] = partes as [string, string, string]
  return { tenantId, clientId, serviceId }
}

/** Endereço público do agendamento com o link. Sem base configurada, devolve só o caminho. */
export function urlDoLinkDeVolta(base: string | null | undefined, slug: string, token: string): string {
  const raiz = (base ?? '').replace(/\/+$/, '')
  return `${raiz}/${slug}/agendar?volta=${encodeURIComponent(token)}`
}

/**
 * A chamada manual mais recente desta pessoa, dentro da janela do link. Só as chamadas manuais
 * (`template = 'recover_manual'`, `registrarChamadaManual`) carregam o link de volta.
 */
async function chamadaDaJanela(db: Cliente, alvo: AlvoDoLinkDeVolta, agora: Temporal.Instant, filtro: 'nao_aberta' | 'sem_agendamento') {
  const desde = agora.subtract({ hours: DIAS_DO_LINK_DE_VOLTA * 24 }).toString()
  let consulta = db
    .from('messages')
    .select('id')
    .eq('tenant_id', alvo.tenantId)
    .eq('client_id', alvo.clientId)
    .eq('template', 'recover_manual')
    .gte('sent_at', desde)
  consulta = filtro === 'nao_aberta' ? consulta.is('clicked_at', null) : consulta.is('booked_appointment_id', null)
  const { data, error } = await consulta.order('sent_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

/**
 * Marca a abertura do link na chamada mais recente que ainda não tinha sido aberta. Abrir duas
 * vezes não move a primeira marca. Sem chamada na janela (o "Chamar" não chegou a ser anotado),
 * não marca nada: é medição, não pode quebrar a página de agendamento.
 */
export async function registrarAberturaDoLinkDeVolta(
  db: Cliente,
  alvo: AlvoDoLinkDeVolta,
  agora: Temporal.Instant = Temporal.Now.instant(),
): Promise<boolean> {
  const id = await chamadaDaJanela(db, alvo, agora, 'nao_aberta')
  if (!id) return false

  // Zero linhas = outra aba abriu o mesmo link entre a leitura e esta escrita. A primeira abertura
  // já ficou marcada; esta só não conta de novo.
  const { data, error } = await db
    .from('messages')
    .update({ clicked_at: agora.toString() })
    .eq('tenant_id', alvo.tenantId)
    .eq('id', id)
    .is('clicked_at', null)
    .select('id')

  if (error) throw error
  return (data ?? []).length > 0
}

/** Liga o agendamento feito pelo link à chamada mais recente ainda sem agendamento. */
export async function registrarAgendamentoPeloLinkDeVolta(
  db: Cliente,
  alvo: AlvoDoLinkDeVolta,
  appointmentId: string,
  agora: Temporal.Instant = Temporal.Now.instant(),
): Promise<boolean> {
  const id = await chamadaDaJanela(db, alvo, agora, 'sem_agendamento')
  if (!id) return false

  // Zero linhas = dois agendamentos pelo mesmo link quase juntos; o primeiro fica com a chamada.
  const { data, error } = await db
    .from('messages')
    .update({ booked_appointment_id: appointmentId })
    .eq('tenant_id', alvo.tenantId)
    .eq('id', id)
    .is('booked_appointment_id', null)
    .select('id')

  if (error) throw error
  if ((data ?? []).length === 0) return false

  // Quem agendou pelo link abriu o link, mesmo que a página tenha sido aberta antes desta chamada
  // existir. Só preenche se estiver vazio: zero linhas aqui é o caso normal (já estava aberta).
  const { error: erroAbertura } = await db
    .from('messages')
    .update({ clicked_at: agora.toString() })
    .eq('tenant_id', alvo.tenantId)
    .eq('id', id)
    .is('clicked_at', null)
    .select('id')

  if (erroAbertura) throw erroAbertura
  return true
}

/**
 * Põe o link de volta em cada item da lista Recuperar. Só HMAC, sem ida ao banco.
 *
 * Sem chave de assinatura no ambiente, `gerarTokenAssinado` lança. Aqui isso não pode derrubar a
 * tela Recuperar (o botão central do produto): cada item fica com `linkVolta: null` e o "Chamar"
 * manda o texto de sempre, sem link. Medição a menos, nunca tela quebrada.
 */
export function comLinksDeVolta<T extends { clientId: string; serviceId: string }>(
  itens: T[],
  tenantId: string,
  slug: string,
  base: string | null | undefined = process.env.NEXT_PUBLIC_APP_URL,
  segredo?: string,
): (T & { linkVolta: string | null })[] {
  try {
    return itens.map((item) => ({
      ...item,
      linkVolta: urlDoLinkDeVolta(base, slug, gerarTokenDeVolta({ tenantId, clientId: item.clientId, serviceId: item.serviceId }, segredo)),
    }))
  } catch (erro) {
    console.error(JSON.stringify({ level: 'error', event: 'link_de_volta_sem_chave', tenantId }), erro)
    return itens.map((item) => ({ ...item, linkVolta: null }))
  }
}
