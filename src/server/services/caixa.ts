import { Temporal } from '@js-temporal/polyfill'

import { concentracaoDeLucro, ratearLucroDaComanda, type Concentracao } from '@/core/caixa/concentracao'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

export type ResumoCaixa = {
  ticketsCount: number
  revenueCents: number
  materialCents: number
  feeCents: number
  commissionCents: number
  /** §5, "Sobrou" = receita − material − taxa − comissão. */
  profitCents: number
}

/**
 * TICKET-047. Soma direto de `tickets`, não da view `v_daily_cash` (0001):
 * a view agrupa por `date_trunc('day', closed_at)`, que trunca no fuso da
 * SESSÃO do Postgres — UTC por padrão via PostgREST, não o fuso do tenant.
 * Um fechamento às 23h de Brasília (02h UTC do dia seguinte) cairia no dia
 * errado. Buscar as linhas cruas e somar em memória, com o limite calculado
 * em `Temporal` no fuso do tenant (mesmo padrão do TICKET-022/025), evita o
 * bug em vez de herdá-lo. Registrado em `docs/DECISOES.md`.
 */
async function somarTickets(db: Cliente, tenantId: string, inicio: string, fim: string): Promise<ResumoCaixa> {
  const resumo: ResumoCaixa = { ticketsCount: 0, revenueCents: 0, materialCents: 0, feeCents: 0, commissionCents: 0, profitCents: 0 }

  /*
    `buscarTudoPaginado` em vez do laço à mão. A paginação estava certa — o que faltava era teto:
    `for (;;)` só saía na página curta, então uma consulta que devolvesse sempre página cheia
    rodaria para sempre e prenderia a função. O helper erra ao passar de 100 mil linhas, e errar é
    a saída certa aqui: um fechamento de caixa somado sobre parte dos tickets é redondo, plausível
    e não denuncia nada — que é justamente a "pior forma do defeito" que o `paginar.ts` descreve.

    A troca custa juntar as linhas em memória em vez de somar página a página. São cinco números
    por ticket, num recorte de um dia de um salão; o teto do helper limita o pior caso, e ele só é
    alcançado num cenário que hoje travaria.
  */
  const tickets = await buscarTudoPaginado(() =>
    db
      .from('tickets')
      .select('total_cents, material_cost_cents, fee_cents, commission_cents, profit_cents')
      .eq('tenant_id', tenantId)
      .in('status', ['closed', 'paid'])
      .gte('closed_at', inicio)
      .lt('closed_at', fim)
      .order('id'),
  )

  for (const t of tickets) {
    resumo.ticketsCount++
    resumo.revenueCents += t.total_cents
    resumo.materialCents += t.material_cost_cents
    resumo.feeCents += t.fee_cents
    resumo.commissionCents += t.commission_cents
    resumo.profitCents += t.profit_cents
  }

  return resumo
}

/** `GET /cash/daily?date=`. */
export async function fechamentoDiario(db: Cliente, tenantId: string, timezone: string, date: string): Promise<ResumoCaixa & { date: string }> {
  const dia = Temporal.PlainDate.from(date)
  const inicio = dia.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fim = dia.add({ days: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const resumo = await somarTickets(db, tenantId, inicio, fim)
  return { date, ...resumo }
}

/** `GET /cash/summary?month=` — `month` no formato `YYYY-MM`. */
export async function resumoMensal(db: Cliente, tenantId: string, timezone: string, month: string): Promise<ResumoCaixa & { month: string }> {
  const [ano, mes] = month.split('-').map(Number)
  if (!ano || !mes) throw AppError.validacao({ month: 'Use o formato AAAA-MM.' })

  const anoMes = Temporal.PlainYearMonth.from({ year: ano, month: mes })
  const inicio = anoMes.toPlainDate({ day: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fim = anoMes
    .toPlainDate({ day: 1 })
    .add({ months: 1 })
    .toZonedDateTime({ timeZone: timezone, plainTime: '00:00' })
    .toInstant()
    .toString()

  const resumo = await somarTickets(db, tenantId, inicio, fim)
  return { month, ...resumo }
}

export type ConcentracaoDoMes = Concentracao & {
  /** Nome de cada profissional, para a tela não precisar de uma segunda consulta. */
  nomes: Record<string, string>
}

/**
 * `docs/48` C7 — de quem depende o que sobra.
 *
 * `docs/47` P07: *"um barbeiro bom pede as contas — e leva metade da clientela junto"*. A pesquisa
 * não achou sistema nenhum do setor que meça isso; o dono descobre o tamanho da dependência no dia
 * da demissão.
 *
 * O número sai do lucro **congelado** de cada comanda, rateado entre os profissionais dos itens
 * dela — nunca de um segundo cálculo. Somar as fatias tem que dar exatamente o "Sobrou no mês" que
 * aparece na mesma tela; duas somas diferentes do mesmo dinheiro é a armadilha de livro-caixa que
 * esta base já pagou uma vez.
 */
export async function concentracaoDoMes(db: Cliente, tenantId: string, timezone: string, month: string): Promise<ConcentracaoDoMes> {
  const [ano, mes] = month.split('-').map(Number)
  if (!ano || !mes) throw AppError.validacao({ month: 'Use o formato AAAA-MM.' })

  const anoMes = Temporal.PlainYearMonth.from({ year: ano, month: mes })
  const inicio = anoMes.toPlainDate({ day: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()
  const fim = anoMes.toPlainDate({ day: 1 }).add({ months: 1 }).toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString()

  const comandas = await buscarTudoPaginado(() =>
    db
      .from('tickets')
      .select('id, profit_cents')
      .eq('tenant_id', tenantId)
      .in('status', ['closed', 'paid'])
      .gte('closed_at', inicio)
      .lt('closed_at', fim)
      .order('id'),
  )
  if (comandas.length === 0) return { ...concentracaoDeLucro([]), nomes: {} }

  const lucroPorComanda = new Map(comandas.map((t) => [t.id, t.profit_cents]))

  /*
    O join, e não `in('ticket_id', [...])`.

    A primeira versão passava a lista de ids: num mês de 800 comandas isso vira uma URL de ~30 KB,
    e o PostgREST recusa muito antes disso — a paginação não ajuda, porque o problema é o tamanho
    do FILTRO, não o da resposta. Falharia só no salão movimentado, que é o único onde este número
    interessa.

    O recorte de data é reescrito aqui de propósito, com as MESMAS variáveis `inicio`/`fim` da
    consulta acima: é a mesma string, então não há a divergência de fronteira de mês em que o
    `comissao.ts` já se queimou. Duas consultas com o mesmo recorte, não dois recortes.
  */
  const itens = await buscarTudoPaginado(() =>
    db
      .from('ticket_items')
      .select('ticket_id, professional_id, total_cents, tickets!inner(status, closed_at)')
      .eq('tenant_id', tenantId)
      .in('tickets.status', ['closed', 'paid'])
      .gte('tickets.closed_at', inicio)
      .lt('tickets.closed_at', fim)
      .order('id'),
  )

  const itensPorComanda = new Map<string, { professionalId: string | null; totalCents: number }[]>()
  for (const item of itens) {
    const lista = itensPorComanda.get(item.ticket_id) ?? []
    lista.push({ professionalId: item.professional_id, totalCents: item.total_cents })
    itensPorComanda.set(item.ticket_id, lista)
  }

  const rateios = [...lucroPorComanda].map(([ticketId, lucro]) => ratearLucroDaComanda(lucro, itensPorComanda.get(ticketId) ?? []))
  const concentracao = concentracaoDeLucro(rateios)

  const ids = concentracao.fatias.map((f) => f.professionalId).filter((id): id is string => Boolean(id))
  const nomes: Record<string, string> = {}
  if (ids.length > 0) {
    const { data, error } = await db.from('professionals').select('id, display_name').eq('tenant_id', tenantId).in('id', ids)
    if (error) throw new AppError('INTERNAL', { cause: error })
    for (const p of data ?? []) nomes[p.id] = p.display_name
  }

  return { ...concentracao, nomes }
}
