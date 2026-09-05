import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'

import { deveCreditarIndicacao } from '@/core/loyalty/indicacao'
import { diaNoFuso } from '@/core/tempo/dia'
import { podeUsarModulo } from '@/core/billing/planos'
import { AppError } from '@/server/http/errors'
import { contextoDePlano } from '@/server/services/planos'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

// ───────────────────────────────────────────── pontos

export const EsquemaPontos = z.object({
  points: z.number().int().refine((n) => n !== 0, 'Informe quantos pontos.').min(-10_000).max(10_000),
  reason: z.string().trim().min(2, 'Diga o motivo.').max(120),
  appointmentId: z.uuid().nullish(),
})

export type ExtratoPontos = {
  /** De TODOS os lançamentos, não só dos que `lancamentos` traz — ver `saldoDeTodosOsLancamentos`. */
  saldo: number
  /** Os mais recentes, para a tela. Não é o extrato completo, e o saldo não sai daqui. */
  lancamentos: { id: string; points: number; reason: string; createdAt: string }[]
}

// ───────────────────────────────────────────── configuração e automação

/*
 * Estes dois textos deixaram de ser rótulo e viraram CHAVE: `MOTIVO_VEIO_POR_INDICACAO` é o que
 * `creditarPontos` consulta para saber se o bônus de indicação já foi pago. Mudar a string sem
 * migrar as linhas existentes faz o bônus ser pago de novo para quem já recebeu.
 */
export const MOTIVO_VEIO_POR_INDICACAO = 'Veio por indicação'
export const MOTIVO_INDICOU = 'Indicou um novo cliente'

export const EsquemaConfigFidelidade = z.object({
  /** 0 desliga a pontuação automática — nem todo negócio quer fidelidade ligada. */
  pointsPerReal: z.number().int().min(0).max(100),
  referralBonusPoints: z.number().int().min(0).max(10_000),
  /** A cada quantos pontos completa uma "volta" da barra de progresso na ficha. */
  rewardThreshold: z.number().int().min(1).max(100_000),
  rewardLabel: z.string().trim().max(80).nullish(),
})
export type ConfigFidelidade = z.infer<typeof EsquemaConfigFidelidade>

const CONFIG_PADRAO: ConfigFidelidade = {
  pointsPerReal: 1,
  referralBonusPoints: 20,
  rewardThreshold: 100,
  rewardLabel: null,
}

/** Um campo válido do namespace sobrevive mesmo se o vizinho estiver torto. */
function campo<T>(esquema: z.ZodType<T>, valor: unknown, padrao: T): T {
  const r = esquema.safeParse(valor)
  return r.success ? r.data : padrao
}

/**
 * Nunca lança — tenant antigo pode não ter `settings.loyalty` nenhum; vira o padrão.
 *
 * **O resgate é campo a campo, e isso não é preciosismo.** A versão anterior fazia
 * `safeParse` do objeto inteiro e caía em `CONFIG_PADRAO` na primeira inválida. Medido: um tenant
 * com `pointsPerReal: 0` — fidelidade DESLIGADA de propósito, o que o próprio comentário do
 * esquema chama de escolha legítima ("nem todo negócio quer fidelidade ligada") — voltava para
 * `pointsPerReal: 1` se qualquer OUTRO campo do namespace ficasse inválido: um `rewardLabel`
 * longo demais, um `rewardThreshold` fora da faixa, um campo faltando.
 *
 * Religar sozinho custa mais que os outros erros desta família, porque não é só um número na
 * tela: `pontuarAtendimentoConcluido` grava em `loyalty_entries`, que é livro-razão — resgate é
 * lançamento negativo, nunca `UPDATE` (regra 11). Ponto creditado por engano vira obrigação com a
 * cliente, e desfazer é tirar da frente dela algo que ela já viu.
 *
 * Escolher o lado oposto (cair para "desligado" quando o objeto está torto) teria o defeito
 * espelhado: um tenant com fidelidade LIGADA e um rótulo inválido pararia de pontuar em silêncio.
 * Por isso o conserto não escolhe lado nenhum — preserva o que dá para ler e só troca pelo padrão
 * o campo que de fato não dá. É a mesma forma de `lerConfiguracoesAgenda`.
 *
 * O caminho realista até aqui não é edição manual: é apertar o esquema. Diminuir o máximo de
 * `rewardLabel`, ou acrescentar campo obrigatório, invalidaria de uma vez o namespace inteiro de
 * quem já tinha valor gravado.
 */
export function lerConfigFidelidade(settings: unknown): ConfigFidelidade {
  const bruto = settings && typeof settings === 'object' ? (settings as Record<string, unknown>).loyalty : null
  const completo = EsquemaConfigFidelidade.safeParse(bruto ?? {})
  if (completo.success) return completo.data

  const obj = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {}
  const forma = EsquemaConfigFidelidade.shape
  return {
    pointsPerReal: campo(forma.pointsPerReal, obj.pointsPerReal, CONFIG_PADRAO.pointsPerReal),
    referralBonusPoints: campo(forma.referralBonusPoints, obj.referralBonusPoints, CONFIG_PADRAO.referralBonusPoints),
    rewardThreshold: campo(forma.rewardThreshold, obj.rewardThreshold, CONFIG_PADRAO.rewardThreshold),
    rewardLabel: campo(forma.rewardLabel, obj.rewardLabel, CONFIG_PADRAO.rewardLabel),
  }
}

/** Mesmo padrão de merge de `site.ts`: lê `settings` inteiro, troca só a chave `loyalty`. */
export async function atualizarConfigFidelidade(db: Cliente, tenantId: string, entrada: ConfigFidelidade) {
  const { data: atual, error: erroLeitura } = await db.from('tenants').select('settings').eq('id', tenantId).single()
  if (erroLeitura) throw new AppError('INTERNAL', { cause: erroLeitura })

  const settingsAtual = (atual.settings ?? {}) as Record<string, unknown>
  const { error } = await db
    .from('tenants')
    .update({ settings: { ...settingsAtual, loyalty: entrada } })
    .eq('id', tenantId)
  if (error) throw new AppError('INTERNAL', { cause: error })
  return entrada
}

/**
 * O que transforma fidelidade de "botão que a profissional lembra de apertar" em automação de
 * verdade — chamado por `concluirAgendamento` depois que o atendimento vira `done`. Nunca lança
 * (mesmo padrão do recálculo de ciclo ali do lado): premiar pontos é bônus, não pode derrubar a
 * conclusão do atendimento se falhar.
 *
 * Cobre dois casos, que podem coexistir na mesma conclusão:
 * 1. Pontos pela própria visita (`pointsPerReal × valor`), se a configuração tiver isso ligado.
 * 2. Bônus de indicação, só na PRIMEIRA visita concluída de quem foi indicado — pesquisa de
 *    mercado (Trinks, BonusQR) mostra que o padrão do nicho é recompensar os dois lados
 *    (`referred_by`), não só quem chegou.
 */
export async function pontuarAtendimentoConcluido(
  db: Cliente,
  tenantId: string,
  entrada: { appointmentId: string; clientId: string; priceCents: number },
): Promise<void> {
  /*
   * A automação também é o módulo `loyalty`, e ela é o buraco que as travas de rota não alcançam:
   * ninguém precisa apertar nada para cair nele. `CONFIG_PADRAO` nasce com `pointsPerReal: 1`, e
   * `lerConfigFidelidade` devolve esse padrão para quem não tem `settings.loyalty`.
   *
   * Medido em produção em 2026-08-26, e é o que motivou esta linha: **nenhum** dos 11 tenants tem
   * `settings.loyalty` gravado — e ainda assim `dom-rocha` acumulou 9 lançamentos em 263
   * atendimentos concluídos. Ou seja, `PATCH /tenant/loyalty-config` nunca foi chamado por
   * ninguém, e a fidelidade automática rodava mesmo assim. Travar aquela rota (o que o PR do lado
   * fez, e está certo) impede LIGAR o que já vinha ligado por omissão; só esta checagem aqui
   * impede um tenant `gratis` de continuar pontuando sozinho.
   *
   * Decide sem lançar, de propósito: o contrato desta função (documentado acima e garantido pelo
   * `.catch()` de quem chama) é nunca derrubar a conclusão do atendimento. "Não tem o módulo" é
   * uma decisão, não uma falha — não vira erro no log nem alerta no Sentry.
   */
  const plano = await contextoDePlano(db, tenantId)
  if (podeUsarModulo(plano, 'loyalty').estado !== 'liberado') return

  const { data: tenant } = await db.from('tenants').select('settings').eq('id', tenantId).maybeSingle()
  const config = lerConfigFidelidade(tenant?.settings)

  const lancamentos: Database['public']['Tables']['loyalty_entries']['Insert'][] = []

  if (config.pointsPerReal > 0) {
    const pontos = Math.floor((entrada.priceCents / 100) * config.pointsPerReal)
    if (pontos > 0) {
      lancamentos.push({
        tenant_id: tenantId,
        client_id: entrada.clientId,
        appointment_id: entrada.appointmentId,
        points: pontos,
        reason: 'Pontos do atendimento',
      })
    }
  }

  if (config.referralBonusPoints > 0) {
    const { data: cliente } = await db.from('clients').select('referred_by').eq('id', entrada.clientId).maybeSingle()

    if (cliente?.referred_by) {
      /*
       * A condição aqui era `visits_count === 0`, com o raciocínio de que o contador só reflete o
       * job diário e portanto ainda mostra o número ANTES desta visita. O raciocínio está certo e
       * o efeito é o oposto do pretendido: como o contador NÃO muda entre uma conclusão e a
       * seguinte, ele continua `0` na segunda, na terceira, e em toda conclusão até o cron rodar
       * — e o `segments` roda uma vez por dia, com 5 a 6 horas de atraso medido do GitHub Actions.
       *
       * Ou seja, duas conclusões da mesma cliente antes do cron pagavam o bônus de indicação DUAS
       * VEZES, para ela e para quem indicou. Corte e barba marcados como dois atendimentos no
       * mesmo dia bastam. Ponto de fidelidade é resgatável, então é dinheiro saindo por engano —
       * e do jeito mais difícil de perceber, porque o extrato mostra dois lançamentos com o mesmo
       * motivo e nada acusa.
       *
       * Conferir o LIVRO-RAZÃO em vez do contador não depende de cron nenhum: se o lançamento
       * existe, o bônus já foi pago. Idempotente por construção, que é o que uma regra de
       * "primeira vez" precisa ser.
       */
      const { count, error: erroBonus } = await db
        .from('loyalty_entries')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', entrada.clientId)
        .eq('reason', MOTIVO_VEIO_POR_INDICACAO)
      if (erroBonus) throw new AppError('INTERNAL', { cause: erroBonus })

      if (deveCreditarIndicacao({ bonusPoints: config.referralBonusPoints, referredBy: cliente.referred_by, bonusJaCreditado: (count ?? 0) > 0 })) {
        lancamentos.push(
          { tenant_id: tenantId, client_id: cliente.referred_by, points: config.referralBonusPoints, reason: MOTIVO_INDICOU },
          { tenant_id: tenantId, client_id: entrada.clientId, points: config.referralBonusPoints, reason: MOTIVO_VEIO_POR_INDICACAO },
        )
      }
    }
  }

  if (lancamentos.length === 0) return
  const { error } = await db.from('loyalty_entries').insert(lancamentos)
  if (error) throw new AppError('INTERNAL', { cause: error })
}

/**
 * Livro-razão de pontos: só entra linha, nunca some (regra 11). Resgatar é lançar pontos
 * negativos com o motivo — assim o cliente que pergunta "por que eu tinha 80 e agora tenho 30?"
 * tem resposta na tela, em vez de um número que mudou sozinho.
 */
const LANCAMENTOS_NA_TELA = 50
const PAGINA_DO_SALDO = 1000
const MAXIMO_DE_PAGINAS = 100

/**
 * O saldo sai de TODOS os lançamentos, e essa é a correção — ele saía dos 50 que a tela mostra.
 *
 * `.limit(50)` é um limite de APRESENTAÇÃO, e estava servindo de base para uma SOMA. Passando de 50
 * lançamentos, os mais antigos caíam fora e o saldo ficava errado; como a ordem é `created_at`
 * desc, o que se perde primeiro são os créditos ganhos no começo. Quem tem mais de 50 lançamentos
 * é, por definição, o cliente mais fiel — e era a ele que o produto dizia "só há N ponto(s)
 * disponível(is)" ao recusar o resgate, porque `lancarPontos` guarda o resgate com este mesmo
 * saldo. Nas duas direções: se os antigos que caíram fora fossem resgates, o saldo inflava e a
 * trava deixava passar mais do que existia.
 *
 * A ironia mora na docstring de cima: a função existe para que ninguém veja "um número que mudou
 * sozinho" — e a barra de progresso da tela ANDAVA PARA TRÁS sozinha, quando um lançamento novo
 * empurrava um crédito velho para fora da janela de 50.
 *
 * ## Por que paginar, e não só tirar o `.limit()`
 *
 * Tirar o limite trocaria um corte silencioso de 50 por outro: o PostgREST tem teto próprio de
 * linhas por resposta, então o mesmo defeito voltaria mais tarde e mais difícil de achar. Aqui a
 * página é explícita, o laço só termina quando vem página curta, e o teto tem ERRO em vez de
 * resposta torta — 100 mil lançamentos num cliente é defeito de dado, e nesse caso o certo é
 * gritar, não devolver um saldo plausível.
 *
 * Soma em JS, e não `sum()` no banco, pelo mesmo motivo que `ehDemonstracao` é lista em código e
 * não coluna: migration neste projeto não sobe por deploy automático, então uma função nova ficaria
 * quebrada entre o deploy e a aplicação manual — e o sintoma seria saldo zerado, pior que o
 * problema original. A view continua sendo o alvo durável.
 */
async function saldoDeTodosOsLancamentos(db: Cliente, tenantId: string, clientId: string): Promise<number> {
  let saldo = 0
  for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
    const de = pagina * PAGINA_DO_SALDO
    const { data, error } = await db
      .from('loyalty_entries')
      .select('points')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('id', { ascending: true })
      .range(de, de + PAGINA_DO_SALDO - 1)
    if (error) throw new AppError('INTERNAL', { cause: error })

    const linhas = data ?? []
    saldo += linhas.reduce((s, l) => s + l.points, 0)
    if (linhas.length < PAGINA_DO_SALDO) return saldo
  }
  throw new AppError('INTERNAL', {
    cause: new Error(`Cliente ${clientId} passou de ${MAXIMO_DE_PAGINAS * PAGINA_DO_SALDO} lançamentos de fidelidade.`),
  })
}

export async function extratoDePontos(db: Cliente, tenantId: string, clientId: string): Promise<ExtratoPontos> {
  const [{ data, error }, saldo] = await Promise.all([
    db
      .from('loyalty_entries')
      .select('id, points, reason, created_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(LANCAMENTOS_NA_TELA),
    saldoDeTodosOsLancamentos(db, tenantId, clientId),
  ])

  if (error) throw new AppError('INTERNAL', { cause: error })

  const lancamentos = data ?? []
  return {
    saldo,
    lancamentos: lancamentos.map((l) => ({
      id: l.id,
      points: l.points,
      reason: l.reason,
      createdAt: l.created_at,
    })),
  }
}

export async function lancarPontos(
  db: Cliente,
  tenantId: string,
  clientId: string,
  autorId: string,
  entrada: z.infer<typeof EsquemaPontos>,
) {
  // Resgate não pode deixar o saldo negativo — o cliente estaria "devendo pontos", que não existe.
  if (entrada.points < 0) {
    const { saldo } = await extratoDePontos(db, tenantId, clientId)
    if (saldo + entrada.points < 0) {
      throw AppError.validacao({ points: `Só há ${saldo} ponto(s) disponível(is).` })
    }
  }

  const { data, error } = await db
    .from('loyalty_entries')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      appointment_id: entrada.appointmentId ?? null,
      points: entrada.points,
      reason: entrada.reason,
      created_by: autorId,
    })
    .select('id, points, reason, created_at')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

// ───────────────────────────────────────────── clube de assinatura

export const EsquemaPlano = z.object({
  name: z.string().trim().min(2, 'Dê um nome ao plano.').max(60),
  priceCents: z.number().int().min(0).max(10_000_000),
  /** `null` = ilimitado. Barbearia usa muito "corte quantas vezes quiser por R$ X". */
  sessionsPerMonth: z.number().int().min(1).max(31).nullish(),
  benefits: z.string().trim().max(500).nullish(),
  active: z.boolean().default(true),
})

export const EsquemaAssinatura = z.object({
  planId: z.uuid(),
  billingDay: z.number().int().min(1).max(28),
})

export async function listarPlanos(db: Cliente, tenantId: string) {
  const { data, error } = await db
    .from('subscription_plans')
    .select('id, name, price_cents, sessions_per_month, benefits, active')
    .eq('tenant_id', tenantId)
    .order('price_cents')

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

export async function criarPlano(db: Cliente, tenantId: string, entrada: z.infer<typeof EsquemaPlano>) {
  const { data, error } = await db
    .from('subscription_plans')
    .insert({
      tenant_id: tenantId,
      name: entrada.name,
      price_cents: entrada.priceCents,
      sessions_per_month: entrada.sessionsPerMonth ?? null,
      benefits: entrada.benefits ?? null,
      active: entrada.active,
    })
    .select('id, name, price_cents, sessions_per_month, benefits, active')
    .single()

  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

export type AssinaturaDoCliente = {
  id: string
  planName: string
  priceCents: number
  sessionsPerMonth: number | null
  billingDay: number
  startedOn: string
}

/** A assinatura ativa do cliente, se houver — o índice parcial garante que é no máximo uma. */
export async function assinaturaAtiva(
  db: Cliente,
  tenantId: string,
  clientId: string,
): Promise<AssinaturaDoCliente | null> {
  const { data, error } = await db
    .from('client_subscriptions')
    .select('id, billing_day, started_on, subscription_plans(name, price_cents, sessions_per_month)')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data?.subscription_plans) return null

  return {
    id: data.id,
    planName: data.subscription_plans.name,
    priceCents: data.subscription_plans.price_cents,
    sessionsPerMonth: data.subscription_plans.sessions_per_month,
    billingDay: data.billing_day,
    startedOn: data.started_on,
  }
}

export async function assinar(
  db: Cliente,
  tenantId: string,
  clientId: string,
  entrada: z.infer<typeof EsquemaAssinatura>,
  timezone: string,
) {
  /*
   * `started_on` sai daqui, e nao mais do `default current_date` da coluna (0019).
   *
   * `current_date` e avaliado no fuso da SESSAO, e a do PostgREST e UTC — medido em producao em
   * 31/08. Em Brasilia, assinatura feita das 21h a meia-noite nascia com inicio no DIA SEGUINTE, e
   * no ultimo dia do mes isso joga o comeco da cobranca para o mes seguinte. E a mesma classe das
   * views corrigidas nas migrations 0048/0049, agora num default de coluna.
   *
   * Fica no servico em vez de virar outro default no banco porque o default nao enxerga o tenant:
   * o fuso e por salao, e so quem tem o contexto pode decidir.
   */
  const { data, error } = await db
    .from('client_subscriptions')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      plan_id: entrada.planId,
      billing_day: entrada.billingDay,
      started_on: diaNoFuso(timezone),
    })
    .select('id')
    .single()

  // 23505 = o índice parcial `client_subscriptions_uma_ativa` barrou uma segunda assinatura.
  if (error?.code === '23505') {
    throw AppError.validacao({ planId: 'Esse cliente já tem uma assinatura ativa. Cancele a atual antes.' })
  }
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data
}

/**
 * Cancelar é mudar o estado e datar, nunca apagar (regra 11): o histórico precisa mostrar que a
 * pessoa foi assinante entre tais meses — é o que explica a receita daquele período.
 */
export async function cancelarAssinatura(db: Cliente, tenantId: string, id: string) {
  /*
   * `new Date().toISOString()` datava em UTC: em Brasília, cancelar às 22h gravava o dia
   * seguinte. Num dia 31 isso joga o cancelamento para o mês errado — e o comentário acima diz
   * que a data existe justamente para explicar a receita daquele período.
   *
   * A consulta a mais é aceitável aqui porque cancelar assinatura é ação rara e deliberada; é o
   * mesmo padrão que `agendamentos.ts` usa antes de recalcular o ciclo.
   */
  const { data: tenantRow } = await db.from('tenants').select('timezone').eq('id', tenantId).maybeSingle()
  const hojeNoSalao = Temporal.Now.instant()
    .toZonedDateTimeISO(tenantRow?.timezone ?? 'America/Sao_Paulo')
    .toPlainDate()
    .toString()

  const { data, error } = await db
    .from('client_subscriptions')
    .update({ status: 'canceled', canceled_on: hojeNoSalao })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()

  if (error) throw new AppError('INTERNAL', { cause: error })
  if (!data) throw new AppError('NOT_FOUND', { message: 'Essa assinatura não está mais ativa.' })
  return data
}
