import { acaoDoTexto } from '@/core/mensageria/palavra-de-acao'
import { normalizarTelefoneBR } from '@/server/services/telefone'
import { cancelarAgendamento, confirmarAgendamento } from '@/server/services/agendamentos'

import type { AtualizacaoDeStatus, MensagemRecebida } from '@/server/providers/messaging/types'
import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ResultadoInbound =
  | { resultado: 'agiu'; acao: 'confirmar' | 'cancelar'; tenantId: string; appointmentId: string }
  | { resultado: 'nao_reconhecido' }
  | { resultado: 'ambiguo'; candidatos: number }
  | { resultado: 'sem_correlacao' }
  | { resultado: 'ja_estava_nesse_estado'; tenantId: string; appointmentId: string }

/**
 * "CONFIRMAR"/"CANCELAR" por WhatsApp — bounded de propósito (docs/60, T-01). Não é assistente:
 * duas transições de estado, e só quando a correlação é inequívoca.
 *
 * ## Como se descobre QUAL agendamento a mensagem é sobre
 *
 * A resposta chega só com um número de telefone — nenhum token, nenhum contexto de qual mensagem
 * está sendo respondida (a maioria dos clientes não usa "responder" citando, digita direto). A
 * correlação é: procurar em `messages` o último lembrete de WhatsApp mandado para um cliente com
 * esse telefone, cujo agendamento ainda está `pending` ou `confirmed`. **Exatamente um candidato**
 * é a única resposta que autoriza agir — zero ou mais de um, a função não adivinha.
 *
 * Por que via `messages` e não "qualquer agendamento futuro daquele telefone": exigir que exista
 * um LEMBRETE de verdade enviado é o que impede um número que nunca recebeu nada do CICLO (engano,
 * trote, número reciclado) de cancelar o horário de outra pessoa.
 */
export async function processarMensagemRecebida(db: Cliente, evento: MensagemRecebida): Promise<ResultadoInbound> {
  const acao = acaoDoTexto(evento.body)
  if (!acao) return { resultado: 'nao_reconhecido' }

  const telefone = normalizarTelefoneBR(evento.from) ?? evento.from

  /*
   * Consulta DELIBERADAMENTE cross-tenant: só temos um telefone, e é ela quem descobre A QUEM ele
   * pertence — não há tenant de contexto antes disto. Justificada em
   * `tests/unit/server/consulta-filtra-tenant.test.ts` (JUSTIFICADAS, whatsapp-inbound.ts ::
   * messages) — o detector daquele arquivo já foi corrigido em 2026-09-18 para enxergar esta
   * consulta (checava a palavra "tenant_id" solta na cadeia, que `.select('tenant_id, ...')`
   * também contém; agora checa a CHAMADA de filtro ou a chave de objeto do insert/update).
   */
  const { data: candidatos, error } = await db
    .from('messages')
    .select('tenant_id, appointment_id, sent_at, clients!inner(phone_e164), appointments!inner(status)')
    .eq('channel', 'whatsapp')
    .in('kind', ['reminder', 'confirmation'])
    .eq('clients.phone_e164', telefone)
    .in('appointments.status', ['pending', 'confirmed'])
    .not('appointment_id', 'is', null)
    // `sent_at` é opcional na tabela (mensagem enfileirada mas ainda não despachada não tem data).
    // Sem este filtro, `order by sent_at desc` põe os nulos primeiro — uma reserva na fila
    // pareceria "o lembrete mais recente" na frente de um que já chegou de verdade.
    .not('sent_at', 'is', null)
    .order('sent_at', { ascending: false })

  if (error) throw error
  if (!candidatos || candidatos.length === 0) return { resultado: 'sem_correlacao' }

  /*
   * Um cliente pode ter recebido vários lembretes do MESMO agendamento (D0 e D1, por exemplo) —
   * isso não é ambiguidade, é o mesmo destino contado duas vezes. Ambiguidade de verdade é DOIS
   * agendamentos DIFERENTES ainda em aberto.
   */
  const agendamentosDistintos = new Set(candidatos.map((c) => `${c.tenant_id}:${c.appointment_id}`))
  if (agendamentosDistintos.size > 1) return { resultado: 'ambiguo', candidatos: agendamentosDistintos.size }

  const alvo = candidatos[0]!
  const tenantId = alvo.tenant_id
  const appointmentId = alvo.appointment_id!
  const estadoAtual = (alvo.appointments as unknown as { status: string }).status

  if (acao === 'confirmar') {
    if (estadoAtual !== 'pending') return { resultado: 'ja_estava_nesse_estado', tenantId, appointmentId }
    await confirmarAgendamento(db, tenantId, appointmentId)
    return { resultado: 'agiu', acao: 'confirmar', tenantId, appointmentId }
  }

  // cancelar
  if (estadoAtual !== 'pending' && estadoAtual !== 'confirmed') return { resultado: 'ja_estava_nesse_estado', tenantId, appointmentId }
  await cancelarAgendamento(db, tenantId, appointmentId, { canceledBy: 'client', reason: 'Cancelado pela cliente via WhatsApp' })
  return { resultado: 'agiu', acao: 'cancelar', tenantId, appointmentId }
}

/**
 * Status de entrega (`sent`/`delivered`/`read`/`failed`) — a Meta reenvia o MESMO evento várias
 * vezes (webhook não é exactly-once). `update` por `provider_id` é idempotente por construção:
 * aplicar o mesmo status duas vezes não muda nada, e nunca regride (`read` chegando depois de
 * `failed` não é tratado aqui como progressão — só grava o que a Meta mandou, sem inventar ordem).
 */
export async function processarStatusDeEntrega(db: Cliente, evento: AtualizacaoDeStatus): Promise<{ atualizado: boolean }> {
  const { error, count } = await db
    .from('messages')
    .update({ status: evento.status, error: evento.error ?? null }, { count: 'exact' })
    .eq('provider_id', evento.providerId)

  if (error) throw error
  return { atualizado: (count ?? 0) > 0 }
}
