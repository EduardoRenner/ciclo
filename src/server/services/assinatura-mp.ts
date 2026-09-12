import {
  decidirPlano,
  lerAssinatura,
  valorConfereComDegrau,
  type AssinaturaDoTenant,
  type EventoMP,
} from '@/core/billing/mercado-pago'
import { normalizarPlano } from '@/server/services/planos'
import { consultarPagamento, consultarPreapproval } from '@/server/billing/mercado-pago'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ResultadoWebhookMP =
  | { resultado: 'plano_atualizado'; tenantId: string; plano: string }
  | { resultado: 'sem_assinatura_registrada'; tenantId: string | null }
  | { resultado: 'valor_nao_confere'; tenantId: string }
  | { resultado: 'tenant_nao_encontrado' }

/**
 * G-13 (docs/60) — o webhook de status do Mercado Pago. `core/billing/mercado-pago.ts` já tem toda
 * a regra pura (`decidirPlano`, `valorConfereComDegrau`, `lerAssinatura`); este arquivo é só a cola
 * de I/O que faltava — reconsulta a API do MP (nunca confia no corpo do webhook) e escreve o
 * degrau em `tenants`.
 *
 * ## Por que SEMPRE reconsulta a API, nunca lê o valor do corpo do webhook
 *
 * O corpo da notificação é só "aconteceu algo com o id X" — os CAMPOS que ele eventualmente trouxer
 * (status, valor) não são a fonte da verdade, porque um webhook forjado poderia declarar
 * `status: 'authorized'` para qualquer id. A fonte da verdade é a resposta de
 * `consultarPreapproval`/`consultarPagamento`, autenticada pelo próprio token de acesso do CICLO
 * junto ao MP — por isso `EventoMP` (o que `lerNotificacaoMP` extrai) só carrega `assunto` + `id`.
 *
 * ## Por que um evento de `payment` também reconsulta a PREAPPROVAL, não só o pagamento
 *
 * Um pagamento avulso tem o próprio vocabulário de status (`approved`/`rejected`/...), diferente do
 * vocabulário de assinatura (`STATUS_MP`). Duplicar a decisão a partir do status do pagamento
 * criaria uma segunda definição da mesma regra — a armadilha de "duas cópias da mesma fórmula"
 * já registrada nesta base. Em vez disso, todo evento (assinatura OU pagamento) termina reduzido à
 * MESMA pergunta: "qual é o status ATUAL da assinatura?", respondida sempre pela preapproval.
 */
export async function processarWebhookMP(
  db: Cliente,
  evento: EventoMP,
  // Injetáveis só para teste — sem credencial do MP, não dá para bater na API de verdade. Mesmo
  // padrão de `enviarPushFn` em `mensageria.ts`: produção nunca passa o terceiro/quarto argumento.
  consultarPagamentoFn: typeof consultarPagamento = consultarPagamento,
  consultarPreapprovalFn: typeof consultarPreapproval = consultarPreapproval,
): Promise<ResultadoWebhookMP> {
  const preapprovalId = evento.assunto === 'subscription' ? evento.id : (await consultarPagamentoFn(evento.id)).preapprovalId

  if (!preapprovalId) {
    // Pagamento sem preapproval associado (ex.: cobrança avulsa fora do fluxo de assinatura) —
    // não é este webhook que decide nada sobre ele.
    return { resultado: 'sem_assinatura_registrada', tenantId: null }
  }

  const situacao = await consultarPreapprovalFn(preapprovalId)
  if (!situacao.externalReference) return { resultado: 'tenant_nao_encontrado' }
  const tenantId = situacao.externalReference

  const { data: tenant, error } = await db.from('tenants').select('plan, settings').eq('id', tenantId).maybeSingle()
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!tenant) return { resultado: 'tenant_nao_encontrado' }

  const assinatura = lerAssinatura(tenant.settings)
  if (!assinatura || assinatura.preapproval_id !== preapprovalId) {
    // Preapproval existe no MP mas este tenant não tem registro dela (ou tem uma DIFERENTE) — não
    // dá para saber com segurança qual degrau ela autoriza. Fica como está; alguém humano confere.
    return { resultado: 'sem_assinatura_registrada', tenantId }
  }

  // A guarda contra checkout adulterado: o valor autorizado no MP precisa bater com o degrau que
  // ESTA assinatura diz ter contratado — nunca com um valor que o webhook alegue.
  if (situacao.valorAutorizado !== null && !valorConfereComDegrau(assinatura.plano_contratado, situacao.valorAutorizado)) {
    return { resultado: 'valor_nao_confere', tenantId }
  }

  const planoVigente = normalizarPlano(tenant.plan)
  const decisao = decidirPlano(situacao.status, assinatura.plano_contratado, planoVigente)

  const novaAssinatura: AssinaturaDoTenant = {
    ...assinatura,
    status: situacao.status,
    atualizado_em: new Date().toISOString(),
  }

  const { error: erroUpdate } = await db
    .from('tenants')
    .update({ plan: decisao.plano, settings: { ...(tenant.settings as Record<string, unknown>), assinatura: novaAssinatura } })
    .eq('id', tenantId)
  if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

  return { resultado: 'plano_atualizado', tenantId, plano: decisao.plano }
}
