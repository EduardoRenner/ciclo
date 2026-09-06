import { Temporal } from '@js-temporal/polyfill'

import { concentracaoDeLucro, ratearLucroDaComanda, type Concentracao } from '@/core/caixa/concentracao'
import { margemPorServico, type ItemFechado, type MargemDoServico } from '@/core/caixa/margem-do-servico'
import { mesesJaEncerrados, serieMensal, type SerieMensal } from '@/core/caixa/serie-mensal'
import { calcularTaxaDoMes, type TaxaDoMes } from '@/core/caixa/taxa-por-forma'
import { lerTaxasDePagamento, taxaEstaConfigurada } from '@/core/comanda/taxa-de-pagamento'
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
  /**
   * O aluguel e as contas rateados pelo tempo de cadeira que os atendimentos ocuparam (`0072`).
   *
   * Entrou aqui junto com a coluna, e não depois, por causa de uma armadilha desta casa: tela que
   * lê uma lista FIXA de parcelas para de explicar o total quando a fonte ganha uma parcela nova —
   * e o defeito não dá erro, só deixa uma diferença sem nome no rodapé.
   */
  fixedCostCents: number
  /** §5, "Sobrou" = receita − material − taxa − comissão − aluguel. */
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
  const resumo: ResumoCaixa = { ticketsCount: 0, revenueCents: 0, materialCents: 0, feeCents: 0, commissionCents: 0, fixedCostCents: 0, profitCents: 0 }

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
      .select('total_cents, material_cost_cents, fee_cents, commission_cents, fixed_cost_cents, profit_cents')
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
    resumo.fixedCostCents += t.fixed_cost_cents
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

/**
 * `docs/53` A-01. Duas idas: `tickets` do mês (a mesma janela de `resumoMensal`, mas com
 * `payment_method` — que `somarTickets` não seleciona porque não precisa dele) e `settings` do
 * tenant, para saber se a pergunta da taxa foi respondida. A conta em si é toda em
 * `calcularTaxaDoMes`, puro — aqui só busca e entrega.
 */
export async function taxaPorFormaDoMes(db: Cliente, tenantId: string, timezone: string, month: string): Promise<TaxaDoMes> {
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

  const [tickets, tenant] = await Promise.all([
    buscarTudoPaginado(() =>
      db
        .from('tickets')
        .select('payment_method, total_cents, fee_cents')
        .eq('tenant_id', tenantId)
        .in('status', ['closed', 'paid'])
        .gte('closed_at', inicio)
        .lt('closed_at', fim)
        .order('id'),
    ),
    db.from('tenants').select('settings').eq('id', tenantId).maybeSingle(),
  ])

  const respondida = taxaEstaConfigurada(tenant.data?.settings)
  const taxas = lerTaxasDePagamento(tenant.data?.settings)

  return calcularTaxaDoMes(
    tickets.map((t) => ({ paymentMethod: t.payment_method, totalCents: t.total_cents, feeCents: t.fee_cents })),
    taxas,
    respondida,
  )
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

  const itensPorComanda = new Map<string, { chave: string | null; totalCents: number }[]>()
  for (const item of itens) {
    const lista = itensPorComanda.get(item.ticket_id) ?? []
    lista.push({ chave: item.professional_id, totalCents: item.total_cents })
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

/**
 * `docs/50` L-06 — a margem de cada serviço nos últimos 90 dias, do pior para o melhor.
 *
 * A janela é a mesma da concentração por profissional, e por um motivo prático: as duas respondem
 * "como o salão está indo", e janelas diferentes fariam duas telas discordarem sobre o mesmo
 * período sem que ninguém entendesse por quê.
 *
 * A conta inteira mora em `margemPorServico`. Aqui só se busca o que ela precisa — e se busca do
 * lugar congelado: `ticket_items.cost_cents` e `.commission_cents` são o material e a comissão
 * daquele atendimento, não os de hoje.
 */
export async function margemDosServicos(db: Cliente, tenantId: string, timezone: string, ate: string): Promise<MargemDoServico[]> {
  const fim = Temporal.PlainDate.from(ate).add({ days: 1 })
  const inicio = fim.subtract({ days: 90 })

  const tickets = await buscarTudoPaginado(() =>
    db
      .from('tickets')
      .select('id, discount_cents, fee_cents')
      .eq('tenant_id', tenantId)
      .in('status', ['closed', 'paid'])
      .gte('closed_at', inicio.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString())
      .lt('closed_at', fim.toZonedDateTime({ timeZone: timezone, plainTime: '00:00' }).toInstant().toString())
      .order('id'),
  )
  if (tickets.length === 0) return []

  const itens = await buscarTudoPaginado(() =>
    db
      .from('ticket_items')
      .select('ticket_id, service_id, total_cents, cost_cents, commission_cents')
      .eq('tenant_id', tenantId)
      .in(
        'ticket_id',
        tickets.map((t) => t.id),
      )
      .order('id'),
  )

  const porComanda = new Map<string, ItemFechado[]>()
  for (const i of itens) {
    const lista = porComanda.get(i.ticket_id) ?? []
    lista.push({ serviceId: i.service_id, totalCents: i.total_cents, costCents: i.cost_cents, commissionCents: i.commission_cents })
    porComanda.set(i.ticket_id, lista)
  }

  return margemPorServico(
    tickets
      .map((t) => ({ itens: porComanda.get(t.id) ?? [], discountCents: t.discount_cents, feeCents: t.fee_cents }))
      .filter((c) => c.itens.length > 0),
  )
}

/** Quantos meses fechados a série guarda e mostra. Dois anos: o bastante para ver sazonalidade. */
const MESES_DA_SERIE = 24

/** Quantos meses um único fechamento de comanda congela. O backfill anda ao longo dos próximos. */
const MESES_POR_FECHAMENTO = 3

async function mesesJaCongelados(db: Cliente, tenantId: string, deste: string, ateAntesDe: string) {
  const { data, error } = await db
    .from('monthly_profit')
    .select('month, revenue_cents, profit_cents, tickets_count')
    .eq('tenant_id', tenantId)
    .gte('month', deste)
    .lt('month', ateAntesDe)
    .order('month')
  if (error) throw new AppError('INTERNAL', { cause: error })
  return data ?? []
}

/**
 * Congela os meses já encerrados que ainda não têm linha — `docs/50` L-09.
 *
 * ## Quem chama, e por que não é a tela nem um cron
 *
 * Chamado por `fecharComanda`. A primeira versão escrevia na LEITURA da tela do mês, e isso feria a
 * regra 6 do `CLAUDE.md` (*"escrita sempre por `/api/v1`"*): um GET que grava é escrita fora do
 * caminho que tem idempotência, auditoria e fila offline. Sair dali para um cron seria trocar por
 * um problema pior — cron desta casa atrasa em horas, o `/api/health` devolveu 503 por meses sem
 * ninguém olhar, e o Motor de Ciclo passou um período inteiro sem rodar sozinho.
 *
 * O fechamento de comanda resolve os dois: já é mutação, já passa por `/api/v1`, e acontece em todo
 * salão ativo. A primeira comanda fechada em outubro congela setembro; em regime é uma consulta que
 * devolve tudo e sai.
 */
export async function congelarMesesFechados(db: Cliente, tenantId: string, timezone: string, hoje: string): Promise<void> {
  const mesCorrente = Temporal.PlainDate.from(hoje).with({ day: 1 })
  const janela = mesesJaEncerrados(mesCorrente.toString(), MESES_POR_FECHAMENTO)
  if (janela.length === 0) return

  const jaTem = new Set((await mesesJaCongelados(db, tenantId, janela[janela.length - 1]!, mesCorrente.toString())).map((m) => m.month))
  const faltando = janela.filter((m) => !jaTem.has(m))
  if (faltando.length === 0) return

  const resumos = await Promise.all(
    faltando.map(async (mes) => ({ mes, resumo: await resumoMensal(db, tenantId, timezone, mes.slice(0, 7)) })),
  )

  for (const { mes, resumo } of resumos) {
    /*
     * Mês sem comanda fechada é congelado com zeros de propósito. Pular faria a mesma consulta
     * vazia rodar em todo fechamento, para sempre — e o zero daquele mês é a verdade sobre ele.
     */
    const { error } = await db.from('monthly_profit').insert({
      tenant_id: tenantId,
      month: mes,
      revenue_cents: resumo.revenueCents,
      material_cents: resumo.materialCents,
      fee_cents: resumo.feeCents,
      commission_cents: resumo.commissionCents,
      profit_cents: resumo.profitCents,
      tickets_count: resumo.ticketsCount,
    })

    /*
     * `insert` e não `upsert`, mesmo custando este tratamento à mão. `upsert` com
     * `ignoreDuplicates` produziria o mesmo SQL hoje e deixaria a porta aberta para amanhã: basta
     * alguém trocar a opção para `false` — uma palavra — e a tabela append-only passa a reescrever
     * o passado, que é o ponto inteiro dela. O verbo importa quando ele é a documentação.
     *
     * `23505` (chave duplicada) é sucesso aqui: dois fechamentos simultâneos, e o segundo perde.
     */
    if (error && error.code !== '23505') throw new AppError('INTERNAL', { cause: error })
  }
}

/**
 * A série mensal — `docs/50` L-09. **Só lê.**
 *
 * Meses congelados vêm de `monthly_profit` e são o registro: o que o número ERA na época, mesmo que
 * uma comanda daquele mês seja reaberta depois. Meses encerrados ainda não congelados são somados
 * ao vivo, para a tela não ficar com buracos enquanto o backfill anda — eles congelam no próximo
 * fechamento de comanda. O mês corrente nunca entra: ele ainda vai mudar.
 */
export async function serieMensalDeLucro(db: Cliente, tenantId: string, timezone: string, hoje: string): Promise<SerieMensal> {
  const mesCorrente = Temporal.PlainDate.from(hoje).with({ day: 1 })
  const janela = mesesJaEncerrados(mesCorrente.toString(), MESES_DA_SERIE)
  if (janela.length === 0) return serieMensal([])

  const congelados = await mesesJaCongelados(db, tenantId, janela[janela.length - 1]!, mesCorrente.toString())
  const jaTem = new Set(congelados.map((m) => m.month))

  /*
   * Teto de seis nos ao-vivo: sem ele, uma conta com dois anos de histórico e nada congelado
   * dispararia 24 resumos numa abertura de tela. Os mais recentes são os que a tela mostra
   * primeiro, e o resto aparece conforme o backfill do fechamento anda.
   */
  const aoVivo = await Promise.all(
    janela
      .filter((m) => !jaTem.has(m))
      .slice(0, 6)
      .map(async (mes) => {
        const resumo = await resumoMensal(db, tenantId, timezone, mes.slice(0, 7))
        return { month: mes, revenueCents: resumo.revenueCents, profitCents: resumo.profitCents, ticketsCount: resumo.ticketsCount }
      }),
  )

  return serieMensal([
    ...congelados.map((m) => ({ month: m.month, revenueCents: m.revenue_cents, profitCents: m.profit_cents, ticketsCount: m.tickets_count })),
    ...aoVivo,
  ])
}
