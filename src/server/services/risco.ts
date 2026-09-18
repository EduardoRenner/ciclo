import { Temporal } from '@js-temporal/polyfill'

import { computeNoShowScore, type EntradaScoreRisco, type ResultadoScoreRisco } from '@/core/risk/no-show-score'
import { precisaoDoScore, type DesfechoDoScore, type PrecisaoDoScore } from '@/core/risk/precisao-do-score'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/**
 * TICKET-041. Reúne o histórico de I/O que `computeNoShowScore` (puro, §5.4)
 * precisa. Calculado **na criação** do agendamento — antes de existir
 * confirmação, então `confirmouAte12hAntes` nasce sempre `false` aqui; é uma
 * simplificação registrada em `docs/DECISOES.md`, não um bug: o valor grava a
 * "foto" do risco no momento da marcação, que é quando o booking público
 * precisa decidir se exige sinal (`LIMIAR_SINAL_OBRIGATORIO`).
 *
 * `pagouSinal` fica sempre `false`: o sinal (`depositBps`/`depositMinCents`) existe no schema mas
 * ainda não é cobrado de fato (`docs/DECISOES.md` "CICLO — sinal sem cobrar") — não há o que ler.
 *
 * `assinanteDoClube` LÊ `client_subscriptions` agora. Até 2026-09-18 este campo também era
 * hardcoded `false`, com um comentário dizendo que o clube "não existe ainda" — comentário que
 * ficou parado desde antes do clube nascer (`server/services/clube.ts`). Assinante de verdade
 * estava sendo pontuado como se fosse desconhecido, perdendo os -0,15 que `computeNoShowScore` já
 * prevê para quem paga mensalidade e não tem motivo para faltar.
 */
export async function calcularScoreDeRisco(
  db: Cliente,
  tenantId: string,
  timezone: string,
  entrada: { clientId: string; startsAt: string; agora?: string },
): Promise<ResultadoScoreRisco> {
  const { count: faltasAnteriores, error: erroFaltas } = await db
    .from('appointments')
    .select('id', { head: true, count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', entrada.clientId)
    .eq('status', 'no_show')
  if (erroFaltas) throw new AppError('INTERNAL', { cause: erroFaltas })

  const { count: atendimentosConcluidos, error: erroConcluidos } = await db
    .from('appointments')
    .select('id', { head: true, count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', entrada.clientId)
    .eq('status', 'done')
  if (erroConcluidos) throw new AppError('INTERNAL', { cause: erroConcluidos })

  const { count: assinaturaAtiva, error: erroAssinatura } = await db
    .from('client_subscriptions')
    .select('id', { head: true, count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('client_id', entrada.clientId)
    .eq('status', 'active')
  if (erroAssinatura) throw new AppError('INTERNAL', { cause: erroAssinatura })

  const primeiraVisita = (faltasAnteriores ?? 0) === 0 && (atendimentosConcluidos ?? 0) === 0

  const agora = Temporal.Instant.from(entrada.agora ?? Temporal.Now.instant().toString())
  const startsAt = Temporal.Instant.from(entrada.startsAt)
  const antecedenciaDias = agora.until(startsAt).total('days')

  const inicioLocal = startsAt.toZonedDateTimeISO(timezone)

  const features: EntradaScoreRisco = {
    faltasAnteriores: faltasAnteriores ?? 0,
    primeiraVisita,
    antecedenciaDias,
    confirmouAte12hAntes: false,
    horaLocal: inicioLocal.hour,
    // Postgres/ISO: sábado é o dia 6 (dayOfWeek 6, domingo é 7).
    sabado: inicioLocal.dayOfWeek === 6,
    pagouSinal: false,
    assinanteDoClube: (assinaturaAtiva ?? 0) > 0,
    // "sem falta" de verdade: só conta se este cliente nunca faltou.
    atendimentosSemFalta: (faltasAnteriores ?? 0) === 0 ? (atendimentosConcluidos ?? 0) : 0,
  }

  return computeNoShowScore(features)
}

/**
 * `docs/DECISOES.md` 2026-09-18: `computeNoShowScore` (§5.4) nunca foi medido contra falta de
 * verdade. Lê os agendamentos JÁ RESOLVIDOS (`done` ou `no_show`) dos últimos 12 meses e prova
 * se `LIMIAR_ALERTA_AGENDA` de fato separa quem falta de quem não falta — ver
 * `core/risk/precisao-do-score.ts`.
 *
 * A janela de 12 meses é o mesmo motivo de `previsoesRecentesDoTenant` (`server/services/
 * previsao.ts`): `appointments` cresce para sempre, e a pergunta que importa é "o score está
 * funcionando HOJE", não a média de todo o histórico do tenant.
 *
 * Só entram linhas com `no_show_score` gravado — agendamentos criados antes do TICKET-041 não
 * têm score nenhum, e contá-los como zero inventaria um dado que nunca existiu.
 */
export async function precisaoDoScoreDoTenant(db: Cliente, tenantId: string, hoje: string): Promise<PrecisaoDoScore> {
  const desde = new Date(Date.parse(`${hoje}T12:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10)

  const linhas = await buscarTudoPaginado(() =>
    db
      .from('appointments')
      .select('no_show_score, status')
      .eq('tenant_id', tenantId)
      .in('status', ['done', 'no_show'])
      .not('no_show_score', 'is', null)
      .gte('starts_at', desde)
      .order('id'),
  )

  const desfechos: DesfechoDoScore[] = linhas.map((l) => ({ score: l.no_show_score!, houveFalta: l.status === 'no_show' }))
  return precisaoDoScore(desfechos)
}
