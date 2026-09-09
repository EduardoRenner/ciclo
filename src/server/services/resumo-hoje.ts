import { Temporal } from '@js-temporal/polyfill'

import { listarAlertasDeEstoque, type AlertaEstoque } from '@/server/services/alertas-estoque'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/*
  `health_records` traz só `has_alert`, e o `alert_label` que estava aqui saiu na Unidade 10.
  Ninguém o usava: `hoje.tsx` passa `alertaSaude={...some((h) => h.has_alert)}` e o
  `appointment-row` declara `alertaSaude?: boolean` com a nota "nunca o rótulo clínico, só o
  sinal". O rótulo ia junto no payload do server component até o navegador de quem abre /hoje —
  recepção inclusive — invisível na tela e legível no devtools. Buscar o que não se mostra é
  a forma mais silenciosa de vazar dado de saúde.
*/
const COLUNAS_HOJE =
  'id, starts_at, ends_at, status, price_cents, client_note, address, professional_id, clients ( name, health_records ( has_alert ) ), services ( name ), professionals ( display_name )'

/** Mesmo formato de `LinhaAgendaDia` (TICKET-022) — dá para abrir no mesmo `DetalheAgendamento` da tela de agenda, sem duplicar o sheet de ações. */
export type LinhaHoje = {
  id: string
  starts_at: string
  ends_at: string
  status: string
  price_cents: number
  client_note: string | null
  /** docs/09-PLATAFORMA.md G3+G13 (P2.5) — endereço do atendimento, não do cliente. */
  address: string | null
  professional_id: string
  clients: { name: string; health_records: { has_alert: boolean }[] } | null
  services: { name: string } | null
  professionals: { display_name: string } | null
}

export type ResumoHoje = {
  /**
   * Soma do `price_cents` DO AGENDAMENTO dos atendimentos concluídos hoje. Não é previsão — mas
   * também não é o faturamento: é PREÇO DE TABELA, e não enxerga desconto dado na comanda, item
   * extra lançado nem gorjeta.
   *
   * O comentário aqui dizia "faturado de verdade", e a tela chamava de "Faturado hoje" (corrigido
   * em 31/08 para "Atendido hoje"). Quem tem o número do dinheiro é `caixa.ts`, que soma
   * `tickets.total_cents` das comandas FECHADAS — outro número, de propósito, com outro rótulo
   * ("Entrou no dia"). Os dois estão certos para o que medem; o errado era um deles se chamar
   * faturamento.
   */
  revenueTodayCents: number
  nextClient: LinhaHoje | null
  /** Confirmações pendentes que começam nas próximas 3 horas — o que precisa de atenção agora, não o dia inteiro. */
  alerts: LinhaHoje[]
  /** O que ainda vem hoje, dali para frente, na ordem em que acontece. */
  restOfDay: LinhaHoje[]
  /** TICKET-045: produto pra recomprar ou perto de vencer. Vazio não aparece na tela. */
  stockAlerts: AlertaEstoque[]
  /**
   * I-7, `docs/30-INDICACAO-PLANO.md` §5.3/§6.2d: quantas clientes NASCERAM indicadas
   * (`referred_by` gravado no cadastro, I-1) este mês corrido do fuso do tenant. É o extrato do
   * laço — sem ele o card só teria número; com ele vira motivo de usar (§2.4).
   */
  indicacoesEsteMes: number
}

const JANELA_ALERTA_HORAS = 3

/**
 * TICKET-025. "Carrega em 1 requisição": uma consulta só traz todos os
 * agendamentos de hoje (com join, como o TICKET-022 já fazia) e as quatro
 * seções da tela são recortes em memória dessa mesma lista — não quatro
 * consultas separadas.
 */
export async function resumoDeHoje(db: Cliente, tenantId: string, timezone: string): Promise<ResumoHoje> {
  const agora = Temporal.Now.instant()
  const hoje = agora.toZonedDateTimeISO(timezone).toPlainDate()
  const inicioDoDia = hoje.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()
  const fimDoDia = hoje.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant()

  const inicioDoMes = hoje
    .with({ day: 1 })
    .toZonedDateTime({ timeZone: timezone, plainTime: '00:00' })
    .toInstant()
  const inicioDoMesSeguinte = hoje
    .with({ day: 1 })
    .add({ months: 1 })
    .toZonedDateTime({ timeZone: timezone, plainTime: '00:00' })
    .toInstant()

  const [{ data, error }, stockAlerts, { count: indicacoesEsteMes, error: erroIndicacoes }] = await Promise.all([
    db.from('appointments').select(COLUNAS_HOJE).eq('tenant_id', tenantId).gte('starts_at', inicioDoDia.toString()).lt('starts_at', fimDoDia.toString()).order('starts_at'),
    listarAlertasDeEstoque(db, tenantId, hoje.toString()),
    db
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('referred_by', 'is', null)
      .gte('created_at', inicioDoMes.toString())
      .lt('created_at', inicioDoMesSeguinte.toString()),
  ])
  if (error) throw new AppError('INTERNAL', { cause: error })
  if (erroIndicacoes) throw new AppError('INTERNAL', { cause: erroIndicacoes })

  const linhas = (data ?? []) as unknown as LinhaHoje[]

  const revenueTodayCents = linhas.filter((a) => a.status === 'done').reduce((soma, a) => soma + a.price_cents, 0)

  const aindaPorVir = linhas.filter(
    (a) =>
      ['pending', 'confirmed', 'arrived'].includes(a.status) &&
      Temporal.Instant.compare(Temporal.Instant.from(a.starts_at), agora) >= 0,
  )

  const limiteAlerta = agora.add({ hours: JANELA_ALERTA_HORAS })
  const alerts = aindaPorVir.filter(
    (a) => a.status === 'pending' && Temporal.Instant.compare(Temporal.Instant.from(a.starts_at), limiteAlerta) <= 0,
  )

  return {
    revenueTodayCents,
    nextClient: aindaPorVir[0] ?? null,
    alerts,
    restOfDay: aindaPorVir,
    stockAlerts,
    indicacoesEsteMes: indicacoesEsteMes ?? 0,
  }
}
