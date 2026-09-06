/**
 * A assinatura do CICLO pelo Mercado Pago — a lógica PURA, sem I/O.
 *
 * O `docs/18` §J escolheu Mercado Pago com uma razão específica: Pix a **0,99% sem piso**, e o Pix
 * Automático (Bacen, jan/2026) removeu a única objeção estrutural a Pix como meio de assinatura.
 * O `docs/55` Fase 1.1 pôs a integração como o item que mais importa — nada de receita existe sem
 * ela. Este arquivo é a metade que dá para escrever e testar sem credencial nenhuma: transformar o
 * estado de uma assinatura do MP na decisão sobre `tenants.plan`.
 *
 * O que mora aqui: o formato do que fica em `tenants.settings.assinatura`, o mapa
 * status-do-MP → degrau, e a guarda que impede um checkout adulterado virar `avancado` por R$ 1.
 * O que NÃO mora aqui: falar com a API do MP e escrever no banco — isso é `server/`.
 *
 * ## Por que `tenants.settings`, e não coluna/tabela nova
 *
 * Mesmo padrão de `payment_fees_bps`, `loyalty`, `custo_fixo` (`core/comanda/taxa-de-pagamento.ts`,
 * `core/loyalty/*`): são quatro campos por tenant, jsonb já existe, e migration neste projeto é
 * passo à mão que já virou incidente duas vezes (`docs/62`). Uma tabela `subscriptions` seria
 * cerimônia sem ganho enquanto a regra é "um preapproval por tenant".
 */

import type { PlanoTier } from './planos'

import { PRECO_MENSAL_CENTS } from './planos'

/**
 * Os estados de um "Plano de assinatura" (preapproval) do Mercado Pago.
 *
 * - `pending`   — criado, aguardando a primeira autorização/pagamento. Ainda não pagou.
 * - `authorized`— autorizado e em dia. É o único estado que ENTREGA o degrau contratado.
 * - `paused`    — o MP pausou (falha de pagamento) e faz retentativa automática. Dinheiro em risco,
 *                 mas não perdido — o degrau segue de pé numa janela de graça.
 * - `cancelled` — encerrado (pelo dono, pelo MP após esgotar retentativas, ou por nós). Volta pro grátis.
 */
export const STATUS_MP = ['pending', 'authorized', 'paused', 'cancelled'] as const
export type StatusMP = (typeof STATUS_MP)[number]

export function ehStatusMP(v: unknown): v is StatusMP {
  return typeof v === 'string' && (STATUS_MP as readonly string[]).includes(v)
}

/**
 * O que fica gravado em `tenants.settings.assinatura`. `plano_contratado` é o degrau que o dono
 * escolheu ao assinar — separado do `tenants.plan` VIGENTE de propósito: numa janela de graça os
 * dois divergem (contratou `equipe`, o pagamento falhou, `tenants.plan` ainda é `equipe` mas
 * `em_graca` avisa que isso tem prazo).
 */
export type AssinaturaDoTenant = {
  provedor: 'mercado_pago'
  preapproval_id: string
  plano_contratado: PlanoTier
  status: StatusMP
  /** ISO. Quando a assinatura foi vista pela última vez pelo webhook — para não regredir com evento atrasado. */
  atualizado_em: string
}

export type DecisaoDePlano = {
  /** O degrau que `tenants.plan` deve passar a ter. */
  plano: PlanoTier
  /**
   * O degrau está de pé mas o pagamento está com problema e isso tem prazo. A tela de "Meu plano"
   * usa isso para avisar antes de o degrau cair sozinho — nunca é surpresa.
   */
  emGraca: boolean
}

/**
 * O mapa que este arquivo existe para ter num lugar só.
 *
 * `pending` NÃO entrega o degrau: assinatura criada e não paga é intenção, não contrato. Fica no
 * degrau que o tenant já tinha (o chamador passa o vigente), sem graça — não há o que a graça
 * proteja ainda.
 *
 * `paused` mantém o degrau contratado COM `emGraca`: o MP está retentando, e derrubar o salão no
 * primeiro boleto que não compensou seria a armadilha de "travar no meio do atendimento" do
 * CLAUDE.md, um nível acima. Quem decide quando a graça acaba é o `server/` (uma data), não este mapa.
 *
 * `cancelled` volta pro `gratis` sem graça: acabou. Regra 5.1 continua valendo do outro lado —
 * cair de degrau não apaga nem esconde dado, só trava CRIAR mais (`podeCriar` em `planos.ts`).
 */
export function decidirPlano(
  status: StatusMP,
  planoContratado: PlanoTier,
  planoVigente: PlanoTier,
): DecisaoDePlano {
  switch (status) {
    case 'authorized':
      return { plano: planoContratado, emGraca: false }
    case 'paused':
      return { plano: planoContratado, emGraca: true }
    case 'pending':
      return { plano: planoVigente, emGraca: false }
    case 'cancelled':
      return { plano: 'gratis', emGraca: false }
  }
}

/** Lê `tenants.settings.assinatura` com a mesma desconfiança de `lerTaxasDePagamento`: jsonb livre, nada garantido. */
export function lerAssinatura(settings: unknown): AssinaturaDoTenant | null {
  const raiz = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).assinatura : null
  if (!raiz || typeof raiz !== 'object') return null
  const o = raiz as Record<string, unknown>
  if (o.provedor !== 'mercado_pago') return null
  if (typeof o.preapproval_id !== 'string' || !o.preapproval_id) return null
  if (!ehStatusMP(o.status)) return null
  if (typeof o.plano_contratado !== 'string') return null
  if (typeof o.atualizado_em !== 'string') return null
  return {
    provedor: 'mercado_pago',
    preapproval_id: o.preapproval_id,
    plano_contratado: o.plano_contratado as PlanoTier,
    status: o.status,
    atualizado_em: o.atualizado_em,
  }
}

/** O valor mensal que o MP deve cobrar, em reais com centavos (a API do MP fala reais, não centavos). */
export function valorMensalEmReais(tier: PlanoTier): number {
  const cents = PRECO_MENSAL_CENTS[tier]
  if (!cents || cents <= 0) throw new Error(`valorMensalEmReais: ${tier} não é um degrau cobrável`)
  return cents / 100
}

/**
 * A guarda contra checkout adulterado: o webhook do MP traz o valor autorizado, e ele PRECISA bater
 * com o degrau que estamos prestes a conceder. Sem isto, quem interceptasse o redirect e trocasse
 * `transaction_amount` para 1,00 ganharia `avancado` por um real — a classe de bug de dinheiro que
 * o CLAUDE.md diz que já apareceu várias vezes nesta base.
 *
 * Tolerância de 1 centavo para arredondamento de ponto flutuante do lado do MP; nada além disso.
 */
export function valorConfereComDegrau(tier: PlanoTier, valorAutorizadoReais: number): boolean {
  const esperado = valorMensalEmReais(tier)
  return Math.abs(esperado - valorAutorizadoReais) <= 0.01
}

/**
 * A notificação que o MP manda no webhook. Ele usa dois formatos históricos ao mesmo tempo
 * (`type`+`data.id` no corpo novo, `topic`+`resource` no antigo), então a leitura aceita os dois e
 * devolve o par (assunto, id) normalizado — ou `null`, e aí a rota responde 200 e ignora, porque
 * 4xx faz o MP retentar para sempre um evento que nunca vai mudar.
 */
export type EventoMP = { assunto: 'subscription' | 'payment'; id: string }

export function lerNotificacaoMP(corpo: unknown): EventoMP | null {
  if (!corpo || typeof corpo !== 'object') return null
  const o = corpo as Record<string, unknown>

  const tipo = typeof o.type === 'string' ? o.type : typeof o.topic === 'string' ? o.topic : null
  if (!tipo) return null

  let id: string | null = null
  if (o.data && typeof o.data === 'object' && typeof (o.data as Record<string, unknown>).id === 'string') {
    id = (o.data as Record<string, string>).id ?? null
  } else if (typeof o.resource === 'string') {
    // formato antigo: resource é uma URL terminando no id
    id = o.resource.split('/').filter(Boolean).pop() ?? null
  } else if (typeof o.id === 'string') {
    id = o.id
  }
  if (!id) return null

  if (tipo.includes('preapproval') || tipo === 'subscription') return { assunto: 'subscription', id }
  if (tipo.includes('payment')) return { assunto: 'payment', id }
  return null
}
