import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import { WhatsAppCloudProvider } from '@/server/providers/messaging/whatsapp'
import { quemRecuperar } from '@/core/ciclo/quem-recuperar'
import { enviarComFallback } from '@/server/services/mensageria'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>
type EstadoCiclo = Database['public']['Enums']['cycle_state']

export type ItemRecuperar = {
  clientId: string
  serviceId: string
  name: string
  phone: string | null
  serviceName: string
  state: EstadoCiclo
  lateDays: number
  valueCents: number
  /** O que SOBRA daquele atendimento × a chance de a pessoa voltar. É o que ordena a lista. */
  profitCents: number
  lastCampaignAt: string | null
}

export type ListaRecuperar = {
  totalValueCents: number
  /** A soma do lucro em risco — o que de fato sobra se todo mundo dessa lista voltar. */
  totalProfitCents: number
  count: number
  items: ItemRecuperar[]
}

const LIMITE_PADRAO = 200

/**
 * §2.4: `GET /cycle/recover`. `v_recover_revenue` (0001) já filtra para os
 * quatro estados que valem a pena mostrar (`on_track` nunca aparece aqui) e
 * já vem ordenada por `value_at_risk_cents desc` — não precisa reordenar.
 * `totalValueCents`/`count` somam o filtro inteiro, não só a página que a
 * UI recebe: a profissional precisa do número certo mesmo pedindo `limit=20`.
 */
export async function listarParaRecuperar(
  db: Cliente,
  tenantId: string,
  opcoes: { state?: EstadoCiclo; limit?: number } = {},
): Promise<ListaRecuperar> {
  let consulta = db.from('v_recover_revenue').select('*').eq('tenant_id', tenantId)
  if (opcoes.state) consulta = consulta.eq('state', opcoes.state)

  /*
   * A segunda consulta existe porque `v_recover_revenue` filtra `on_track` FORA — de dentro dela
   * é impossível saber se a cliente tem algum ciclo saudável. Sem essa informação, quem vem todo
   * mês cortar o cabelo entrava na lista de "atrasadas para voltar" por causa de uma progressiva
   * que fez uma vez em março. Ver `core/ciclo/quem-recuperar.ts` para os números medidos.
   */
  const [{ data, error }, { data: saudaveis, error: erroSaudaveis }] = await Promise.all([
    consulta,
    db.from('client_cycles').select('client_id').eq('tenant_id', tenantId).eq('state', 'on_track'),
  ])
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (erroSaudaveis) throw new AppError('INTERNAL', { cause: erroSaudaveis })

  // A view não declara FK nem `not null` para o PostgREST/gerador de tipos,
  // mas toda coluna aqui vem de `join`s obrigatórios sobre colunas `not null`
  // (0001) — o `!` é seguro, não uma aposta.
  const comCicloEmDia = new Set((saudaveis ?? []).map((l) => l.client_id))
  /*
    `docs/48` C3: quem ordena a fila é o LUCRO em risco, não a receita. As duas continuam existindo
    lado a lado (`0067`) porque respondem perguntas diferentes — "quanto está parado" é o número
    que a tela inicial anuncia; "quem vale a pena chamar primeiro" é este.
  */
  const linhas = quemRecuperar(
    (data ?? []).map((l) => ({ ...l, clientId: l.client_id!, ordemCents: l.profit_at_risk_cents ?? 0 })),
    comCicloEmDia,
  )

  /*
   * `count` e `totalValueCents` saem das linhas JÁ reduzidas a uma por cliente. Antes contavam
   * linhas cruas e o cartão rotulado "Clientes" chegou a mostrar 149 num salão com 55 — e a soma
   * de dinheiro contava a mesma pessoa uma vez por serviço atrasado.
   */
  const totalValueCents = linhas.reduce((soma, l) => soma + (l.value_at_risk_cents ?? 0), 0)
  const totalProfitCents = linhas.reduce((soma, l) => soma + l.ordemCents, 0)
  const limite = opcoes.limit ?? LIMITE_PADRAO

  return {
    totalValueCents,
    totalProfitCents,
    count: linhas.length,
    items: linhas.slice(0, limite).map((l) => ({
      clientId: l.client_id!,
      serviceId: l.service_id!,
      name: l.client_name!,
      phone: l.phone_e164,
      serviceName: l.service_name!,
      state: l.state!,
      lateDays: l.late_days!,
      valueCents: l.value_at_risk_cents!,
      profitCents: l.profit_at_risk_cents ?? 0,
      lastCampaignAt: l.last_campaign_at,
    })),
  }
}

export const EsquemaEnviarRecuperar = z.object({
  items: z.array(z.object({ clientId: z.string().uuid(), serviceId: z.string().uuid() })).min(1).max(200),
  mode: z.enum(['ai', 'template']),
  templateId: z.string().optional(),
})
export type EntradaEnviarRecuperar = z.infer<typeof EsquemaEnviarRecuperar>

/**
 * Quatro motivos, e antes eram dois — porque a tela precisa dizer a VERDADE sobre por que não foi.
 *
 * `rate_limited` estava carregando três coisas sem relação: fora do horário permitido, dentro dos
 * 7 dias da última campanha, e falha de entrega de verdade. A tela então nomeava as duas causas
 * que ela achava que existiam ("opt-out ou limite de mensagens") — e nenhuma das duas era a certa
 * nos casos mais comuns:
 *
 * - o dono clica às 21h30, depois de fechar. TODOS caem fora da janela 8h–21h, e ele lê que seus
 *   40 clientes pediram para não receber. A ação certa era "tente amanhã de manhã";
 * - sem credencial da Meta (o estado de hoje), TODOS falham na entrega e ele lê a mesma frase.
 *   Ele nunca abriria chamado sobre a causa real, porque a tela lhe deu outra.
 *
 * Motivo que a tela não sabe nomear é pior que motivo nenhum: manda a pessoa consertar o que não
 * está quebrado. Esta é a mesma família do `cartao-de-confirmacao-em-branco` — a origem ganha um
 * caso, a apresentação continua lendo a lista velha e afirma com confiança.
 */
type MotivoPulado = 'opt_out' | 'rate_limited' | 'fora_de_janela' | 'falha_de_envio'

export type ResultadoEnviarRecuperar = {
  queued: number
  skipped: { clientId: string; reason: MotivoPulado }[]
}

const DIAS_ENTRE_CAMPANHAS = 7
const JANELA_PERMITIDA_INICIO = 8
const JANELA_PERMITIDA_FIM = 21

/**
 * §7, "limites de mensagem": aqui aplicados por linha (client × service), não
 * pelo job diário do TICKET-038 — esta é a ação manual "mandar agora" da
 * tela. Reaproveita a mesma regra de 7 dias porque é a única que faz sentido
 * checar sem o histórico da semana inteira que só o job acumula.
 *
 * `mode: 'ai'` ainda não tem geração de texto (fora de escopo do MVP puro —
 * `01-ESPEC §5.3` não descreve o gerador); cai no mesmo template genérico de
 * recuperação até existir. Decisão em `docs/DECISOES.md`.
 */
export async function enviarParaRecuperar(
  db: Cliente,
  tenantId: string,
  timezone: string,
  entrada: EntradaEnviarRecuperar,
  provider: MessagingProvider = new WhatsAppCloudProvider(),
  // Parâmetro, não `Temporal.Now` direto: um teste que roda às 21h40 (fora da
  // janela 8h–21h) não pode depender da hora real em que ele acontece de
  // rodar — mesmo bug de determinismo já registrado no TICKET-030.
  agora: Temporal.Instant = Temporal.Now.instant(),
): Promise<ResultadoEnviarRecuperar> {
  const agoraLocal = agora.toZonedDateTimeISO(timezone)
  const dentroDaJanela = agoraLocal.hour >= JANELA_PERMITIDA_INICIO && agoraLocal.hour < JANELA_PERMITIDA_FIM

  const skipped: ResultadoEnviarRecuperar['skipped'] = []
  let queued = 0

  /*
   * Uma mensagem por PESSOA no lote, nunca uma por (cliente × serviço).
   *
   * A trava de 7 dias abaixo lê `last_campaign_at` da linha de `client_cycles`, que é por serviço:
   * duas linhas da mesma cliente têm as duas `last_campaign_at` nulas, as duas passam, e a pessoa
   * recebe dois WhatsApp ao mesmo tempo. Com a lista antiga (uma linha por serviço) e o botão de
   * marcar todas, uma cliente atrasada em três serviços recebia TRÊS mensagens no mesmo segundo.
   *
   * A lista agora já vem com uma linha por cliente, então na prática isto não deveria acontecer —
   * e é exatamente por isso que a trava fica aqui também: proteção que depende de o chamador
   * mandar a lista certa não é proteção. O corpo da requisição vem de fora.
   */
  const jaEnviado = new Set<string>()

  for (const item of entrada.items) {
    if (jaEnviado.has(item.clientId)) continue
    jaEnviado.add(item.clientId)

    const { data: linha, error: erroCiclo } = await db
      .from('client_cycles')
      .select('last_campaign_at, state, value_at_risk_cents')
      .eq('tenant_id', tenantId)
      .eq('client_id', item.clientId)
      .eq('service_id', item.serviceId)
      .maybeSingle()
    if (erroCiclo) throw new AppError('INTERNAL', { cause: erroCiclo })
    if (!linha) continue // já não está mais em risco (concluiu, cancelou) — nada a enviar

    if (!dentroDaJanela) {
      skipped.push({ clientId: item.clientId, reason: 'fora_de_janela' })
      continue
    }
    const dentroDosSeteDias =
      linha.last_campaign_at !== null &&
      agora.since(Temporal.Instant.from(linha.last_campaign_at)).total('days') < DIAS_ENTRE_CAMPANHAS
    if (dentroDosSeteDias) {
      skipped.push({ clientId: item.clientId, reason: 'rate_limited' })
      continue
    }

    const { data: cliente, error: erroCliente } = await db
      .from('clients')
      .select('name, phone_e164, email, whatsapp_opt_out')
      .eq('id', item.clientId)
      .single()
    if (erroCliente) throw new AppError('INTERNAL', { cause: erroCliente })
    if (cliente.whatsapp_opt_out || !cliente.phone_e164) {
      skipped.push({ clientId: item.clientId, reason: 'opt_out' })
      continue
    }

    const { data: servico, error: erroServico } = await db.from('services').select('name').eq('id', item.serviceId).single()
    if (erroServico) throw new AppError('INTERNAL', { cause: erroServico })

    const resultado = await enviarComFallback(db, {
      tenantId,
      clientId: item.clientId,
      kind: 'campaign',
      template: entrada.templateId ?? 'recover_client',
      params: { name: cliente.name, service: servico.name },
      fallbackSubject: `Sentimos sua falta, ${cliente.name}!`,
      fallbackBody: `Já faz um tempo desde seu último ${servico.name}. Vamos marcar um novo horário?`,
      whatsappTo: cliente.phone_e164,
      emailTo: cliente.email,
    }, provider)

    if (resultado.status === 'sent') {
      /*
       * `select()` no fim do `update` não é enfeite: é o que transforma "não gravou" em algo que
       * alguém pode ver.
       *
       * No supabase-js, um `update` que não casa linha nenhuma devolve `error: null` — sucesso,
       * zero linhas. E aqui isso é o pior momento possível para um sucesso falso: **a mensagem já
       * saiu**. Sem `last_campaign_at`, a trava de 7 dias lá em cima não tem o que ler, e a mesma
       * cliente entra de novo no próximo lote, recebendo "sentimos sua falta" outra vez.
       *
       * A linha existe (foi lida com o mesmo trio de chaves algumas linhas acima), então zero é
       * corrida com o `recompute_cycles`, que reescreve `client_cycles` seis vezes por dia. É raro
       * — e é exatamente o tipo de raro que ninguém descobre olhando, porque não há erro para
       * olhar. Quem paga é o salão, na conversa com a cliente.
       *
       * Não dá para desfazer o envio, e inventar a linha seria criar um ciclo que o Motor não
       * calculou. O que dá é deixar rastro — ver a decisão de contagem logo abaixo do `if`.
       */
      const { data: carimbadas, error: erroUpdate } = await db
        .from('client_cycles')
        .update({ last_campaign_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('client_id', item.clientId)
        .eq('service_id', item.serviceId)
        .select('client_id')
      if (erroUpdate) throw new AppError('INTERNAL', { cause: erroUpdate })

      if ((carimbadas?.length ?? 0) === 0) {
        console.error(JSON.stringify({
          level: 'error',
          event: 'recuperar_carimbo_nao_gravou',
          detalhe: 'mensagem enviada e last_campaign_at NAO gravado — a trava de 7 dias fica cega para esta cliente',
          tenantId,
          clientId: item.clientId,
          serviceId: item.serviceId,
        }))
      }
      /*
       * Conta como enviada mesmo quando o carimbo falhou, e isto é decisão, não descuido: a
       * mensagem SAIU. Dizer "falha de envio" para a dona seria mentir na direção mais cara —
       * ela reenviaria, e o reenvio é justamente o dano que a trava de 7 dias existe para
       * impedir. O conserto viraria o defeito, com uma volta a mais.
       *
       * A tela mostra o que aconteceu com a cliente; o carimbo perdido é problema operacional, e
       * o lugar dele é o log acima.
       */
      queued++
    } else {
      // Falha de entrega de verdade (WhatsApp, push e e-mail indisponíveis). §2.4 só definia dois
      // motivos e este caía em `rate_limited` "por ser o mais próximo" — mas próximo não é igual:
      // "tentar de novo" é a ação certa para um limite de taxa e é a ação ERRADA aqui, onde
      // tentar de novo falha de novo até alguém configurar o transporte. A linha correspondente
      // em `messages` já nasce `failed` com o erro dos três canais.
      skipped.push({ clientId: item.clientId, reason: 'falha_de_envio' })
    }
  }

  return { queued, skipped }
}
