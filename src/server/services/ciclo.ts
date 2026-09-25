import { Temporal } from '@js-temporal/polyfill'

import { reguaEfetivaDias } from '@/core/ciclo/regua-do-servico'
import { computeCycle } from '@/core/cycle/compute'
import { custoDoServico } from '@/core/comanda/custo-do-servico'
import { lucroEmRiscoCents, lucroEsperadoCents, valorEmRiscoCents } from '@/core/cycle/valor-em-risco'
import { buscarTudoPaginado } from '@/server/db/paginar'
import { calibrarServicos, probabilidadeCalibradaDoTenant, registrarPrevisoes, resolverPrevisoes, type PrevisaoParaRegistrar } from '@/server/services/previsao'
import { registrarEvento } from '@/server/services/product-events'
import { AppError } from '@/server/http/errors'

import type { Database } from '@/server/db/types.gen'
import type { SupabaseClient } from '@supabase/supabase-js'

type Cliente = SupabaseClient<Database>

/** Tamanho do LOTE DE ESCRITA do upsert — outra decisão que o teto de leitura do PostgREST. */
const TAMANHO_DO_LOTE = 1000


/**
 * Um `(client_id, service_id)` só entra no cálculo se tiver pelo menos uma visita
 * conhecida — um atendimento concluído, ou a última vez informada na planilha ou de
 * memória (`client_cycles.last_visit_on`). Cliente que nunca veio para aquele serviço
 * não tem ciclo nenhum a acompanhar (mesma regra de `computeCycle` para histórico
 * vazio, só que aqui a linha nem chega a existir em vez de existir com estado neutro).
 */
type Combinacao = { clientId: string; serviceId: string }

/*
 * `valorEmRiscoCents` mudou para `@/core/cycle/valor-em-risco` (import no topo). Era `preço ×
 * fator`, sem I/O, mas morava aqui — e a consequência não era estética: a tabela que ORDENA a tela
 * "Recuperar receita" só dava para exercitar pelo teste de integração, que precisa de banco no ar,
 * enquanto a outra metade do mesmo `§5.3` (o estado, em `core/cycle/compute.ts`) tinha teste de
 * unidade desde sempre.
 */

/**
 * TICKET-036. Recalcula `client_cycles` de um tenant inteiro numa passada só:
 * carrega tudo em poucas consultas (não uma por cliente) e resolve em
 * memória — é o que faz "10 mil clientes em <60s" ser possível.
 */
export async function recomputarCiclosDoTenant(db: Cliente, tenantId: string, timezone: string, today: string): Promise<number> {
  // `.order('id')` em toda consulta paginada não é enfeite: sem ordem
  // explícita, o Postgres não garante a mesma ordem de linhas entre duas
  // chamadas `.range()` separadas — paginar "às cegas" pode pular ou repetir
  // linha entre uma página e outra. Foi assim que o teste de 10 mil clientes
  // pegou isto: `processados` variava a cada execução (1000, depois 7902).
  const [concluidos, futuros, servicos, probabilidade, assinaturasAtivas, pacotesComSaldo, informadas] = await Promise.all([
    buscarTudoPaginado(() =>
      db
        .from('appointments')
        .select('client_id, service_id, starts_at, professional_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'done')
        .order('id'),
    ),
    buscarTudoPaginado(() =>
      db
        .from('appointments')
        .select('client_id, service_id')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'confirmed', 'arrived'])
        .order('id'),
    ),
    buscarTudoPaginado(() =>
      db.from('services').select('id, cycle_days, cycle_days_observado, price_cents').eq('tenant_id', tenantId).order('id'),
    ),
    // `docs/73` F1: a chance de retorno por estado, calibrada com o histórico deste tenant —
    // continua igual à tabela global até o tenant acumular amostra suficiente por estado.
    probabilidadeCalibradaDoTenant(db, tenantId, today),
    /*
      `docs/DECISOES.md` 2026-09-18: quem tem assinatura ATIVA do CICLO Clube não gera a venda
      avulsa que `value_at_risk_cents`/`profit_at_risk_cents` supõem — o índice parcial
      `client_subscriptions_uma_ativa` (0019) já garante no máximo uma linha por cliente aqui.
    */
    buscarTudoPaginado(() =>
      db.from('client_subscriptions').select('client_id').eq('tenant_id', tenantId).eq('status', 'active').order('id'),
    ),
    /*
      Mesma causa-raiz, terceiro mecanismo de pagamento não-avulso (`docs/DECISOES.md` 2026-09-18,
      achado seguinte): pacote com sessão sobrando. `expires_on` filtrado no banco (vencido não
      conta); `used_sessions < total_sessions` filtrado abaixo em memória — não há operador do
      PostgREST para comparar coluna com coluna (`used_sessions.lt.total_sessions` não existe).
    */
    buscarTudoPaginado(() =>
      db
        .from('packages')
        .select('client_id, service_id, total_sessions, used_sessions')
        .eq('tenant_id', tenantId)
        .or(`expires_on.is.null,expires_on.gte.${today}`)
        .order('id'),
    ),
    /*
      A última visita que o CICLO não viu acontecer: quem entrou pela planilha ou de memória
      (`ciclo-de-quem-ja-atende.ts`) tem a data gravada em `client_cycles.last_visit_on` e nenhum
      atendimento concluído. Sem ler esta coluna, o recálculo só enxergava quem tem atendimento, e
      a ficha dessa gente congelava no estado do dia do cadastro — quem entrou "em dia" nunca
      chegava a Recuperar (docs/82 §16, rodada 17).
    */
    buscarTudoPaginado(() =>
      db
        .from('client_cycles')
        .select('client_id, service_id, last_visit_on')
        .eq('tenant_id', tenantId)
        .not('last_visit_on', 'is', null)
        .order('client_id')
        .order('service_id'),
    ),
  ])
  const assinantesAtivos = new Set(assinaturasAtivas.map((a) => a.client_id))
  /*
    Pacote é POR SERVIÇO (diferente de assinatura, que cobre o tenant inteiro) — a chave inclui
    `service_id`, igual à combinação que `client_cycles` já usa. `remainingSessions > 0` é a mesma
    condição de `PacoteComSaldo` (`server/services/pacotes.ts`), sem trazer a função inteira (que
    também calcula vencimento em dias, que este uso não precisa).
  */
  const combinacoesComPacote = new Set(
    pacotesComSaldo.filter((p) => p.used_sessions < p.total_sessions).map((p) => `${p.client_id}:${p.service_id}`),
  )

  /*
    A régua EFETIVA: a medida quando existe, a configurada quando não.

    `cycle_days` é palpite de catálogo (21 da coluna, ou o do pack da profissão) aplicado a todo
    salão do país; `cycle_days_observado` é a cadência que a clientela DESTE salão de fato tem,
    medida a partir das voltas que aconteceram (`core/cycle/calibracao.ts`). Preferir a medida é o
    ponto inteiro do mecanismo — e a configurada continua intacta na outra coluna, para o dono
    poder comparar e para a correção ser reversível.
  */
  const cycleDaysPorServico = new Map(servicos.map((s) => [s.id, reguaEfetivaDias(s.cycle_days, s.cycle_days_observado)]))
  const precoPorServico = new Map(servicos.map((s) => [s.id, s.price_cents]))

  /*
    `docs/48` C3: a fila de recuperação passa a ser ordenada por LUCRO. As duas peças que faltavam
    — material da ficha de consumo e comissão de quem costuma atender — só passaram a existir com
    a `I-02`/`0066`; até então o material valia zero para todo serviço de todo tenant.

    As duas buscas não dependem uma da outra — só de `servicos`, já resolvido acima — e rodavam em
    `await` separados, uma depois da outra, na MESMA função que otimiza as seis primeiras buscas
    exatamente para não fazer isso (comentário de `TICKET-036` acima). `Promise.all` aqui é o
    mesmo raciocínio aplicado ao que tinha ficado de fora.
  */
  const [materialPorServico, comissaoPor] = await Promise.all([
    materialDeCadaServico(db, tenantId, servicos.map((s) => s.id)),
    comissaoDeCadaProfissional(db, tenantId),
  ])

  const temFuturoPorCombinacao = new Set(futuros.filter((a) => a.client_id).map((a) => `${a.client_id}:${a.service_id}`))

  const historicoPorCombinacao = new Map<string, string[]>()
  /*
    Quem atendeu por ÚLTIMO cada par (cliente, serviço) — a melhor aposta de quem vai atender de
    novo, e é dele a comissão que entra no lucro esperado. Guardado com a data ao lado porque
    `concluidos` vem ordenado por `id`, não por data: pegar "o último da lista" traria o último
    inserido, que numa importação de histórico é qualquer um.
  */
  const ultimoAtendimento = new Map<string, { quando: string; professionalId: string | null }>()
  for (const ag of concluidos) {
    if (!ag.client_id) continue
    const chave = `${ag.client_id}:${ag.service_id}`
    const lista = historicoPorCombinacao.get(chave) ?? []
    lista.push(ag.starts_at)
    historicoPorCombinacao.set(chave, lista)

    const atual = ultimoAtendimento.get(chave)
    if (!atual || ag.starts_at > atual.quando) ultimoAtendimento.set(chave, { quando: ag.starts_at, professionalId: ag.professional_id })
  }
  const ultimoProfissionalPorCombinacao = new Map([...ultimoAtendimento].map(([chave, v]) => [chave, v.professionalId]))

  const hoje = Temporal.PlainDate.from(today)
  const linhas: Database['public']['Tables']['client_cycles']['Insert'][] = []

  /*
    O registro de previsão (`docs/46`) anda de carona neste laço de propósito: as datas de visita
    já estão carregadas e ordenadas aqui, e buscá-las de novo num job à parte seria repetir a
    consulta mais cara do produto para chegar no mesmo dado.
  */
  const previsoes: PrevisaoParaRegistrar[] = []
  const datasPorCombinacao = new Map<string, string[]>()

  const visitaInformada = new Map(informadas.map((c) => [`${c.client_id}:${c.service_id}`, c.last_visit_on!]))
  const combinacoes = new Set([...historicoPorCombinacao.keys(), ...visitaInformada.keys()])

  for (const chave of combinacoes) {
    const [clientId, serviceId] = chave.split(':') as [string, string]
    const defaultCycleDays = cycleDaysPorServico.get(serviceId)
    if (!defaultCycleDays) continue // serviço apagado/desconhecido — sem padrão, sem como calcular

    const doAtendimento = (historicoPorCombinacao.get(chave) ?? [])
      .map((iso) => Temporal.Instant.from(iso).toZonedDateTimeISO(timezone).toPlainDate())
      .sort((a, b) => Temporal.PlainDate.compare(a, b))
    /*
      A data informada só entra quando é MAIS NOVA que o último atendimento: para quem só tem
      atendimento, `last_visit_on` é a própria data do último (gravada por este laço) e não soma
      nada; para quem veio da memória, é a única visita; e para quem voltou e foi marcado em
      "Já atendo" → retornos, é a volta que o atendimento não registrou.
    */
    const informada = visitaInformada.get(chave)
    const ultimoAtendido = doAtendimento[doAtendimento.length - 1]
    const somaInformada =
      informada !== undefined && (!ultimoAtendido || Temporal.PlainDate.compare(Temporal.PlainDate.from(informada), ultimoAtendido) > 0)
    const history = (somaInformada ? [...doAtendimento, Temporal.PlainDate.from(informada)] : doAtendimento).map((date) => ({ date }))

    const resultado = computeCycle({
      history,
      defaultCycleDays,
      today: hoje,
      hasFutureAppointment: temFuturoPorCombinacao.has(chave),
    })

    const ultimaVisita = history[history.length - 1]!.date.toString()
    /*
      A trilha de previsões (`docs/46`) mede o acerto do Motor e calibra a régua: só entra com data
      que um atendimento REGISTROU. "Uns 15 dias" de memória é aproximado por desenho
      (`quando-foi-a-ultima-vez.ts`) e mediria o palpite da pessoa, não o Motor.
    */
    if (doAtendimento.length > 0) datasPorCombinacao.set(chave, doAtendimento.map((d) => d.toString()))
    if (!somaInformada) {
      previsoes.push({
        clientId,
        serviceId,
        lastVisitOn: ultimaVisita,
        predictedOn: resultado.predictedDate.toString(),
        // A tabela exige > 0, e o piso do ciclo pessoal é 0.5 do padrão: sem o `max`, um serviço de
        // ciclo 1 produziria 0 e derrubaria o cron inteiro por violação de constraint.
        personalCycleDays: Math.max(1, Math.round(resultado.personalCycleDays)),
        defaultCycleDays,
      })
    }

    /*
      `docs/DECISOES.md` 2026-09-18: assinante ativo não paga avulso, então o preço de catálogo
      nunca seria cobrado dele de novo — usar `services.price_cents` aqui contaria uma venda que
      não ia acontecer. Zero, não um número menor "estimado": não há como saber, sem duplicar a
      lógica de `janelaDeCobranca`/sessão-do-mês do clube, se esta visita específica cairia dentro
      do plano ou como excedente avulso — e a regra 5.3 do `CLAUDE.md`/`docs/48` §Fase 3 proíbe
      inventar precisão que não existe. O ESTADO (`due`/`late`/...) continua calculado normalmente:
      o valor de lembrar o assinante de usar o que já paga continua existindo, só o dinheiro "em
      risco" — que para ele não é dinheiro de venda avulsa — é que não é.

      Mesmo raciocínio, terceiro mecanismo (`docs/DECISOES.md` 2026-09-18, achado seguinte): quem
      tem PACOTE com sessão sobrando NESTE serviço também não gera venda avulsa na próxima visita —
      ela consome o crédito já pago (`consumirSessao`, `server/services/pacotes.ts`). Diferente da
      assinatura (cobre o tenant inteiro), pacote é por `(cliente, serviço)` — a MESMA granularidade
      de `client_cycles` — então aqui a checagem é mais precisa, não uma aproximação.
    */
    const semVendaAvulsa = assinantesAtivos.has(clientId) || combinacoesComPacote.has(chave)
    const precoEfetivo = semVendaAvulsa ? 0 : (precoPorServico.get(serviceId) ?? 0)

    linhas.push({
      tenant_id: tenantId,
      client_id: clientId,
      service_id: serviceId,
      personal_cycle_days: Math.round(resultado.personalCycleDays),
      last_visit_on: history[history.length - 1]!.date.toString(),
      predicted_on: resultado.predictedDate.toString(),
      late_days: Math.trunc(resultado.lateDays),
      state: resultado.state,
      value_at_risk_cents: valorEmRiscoCents(precoEfetivo, resultado.state, probabilidade),
      profit_at_risk_cents: lucroEmRiscoCents(
        lucroEsperadoCents({
          priceCents: precoEfetivo,
          // Quem atendeu por último naquele serviço é a melhor aposta de quem vai atender de novo.
          commissionBps: comissaoPor(ultimoProfissionalPorCombinacao.get(chave) ?? null, serviceId),
          materialCents: materialPorServico.get(serviceId) ?? 0,
        }),
        resultado.state,
        probabilidade,
      ),
      computed_at: new Date().toISOString(),
    })
  }

  if (linhas.length === 0) return 0

  // upsert por (tenant_id, client_id, service_id) — a PK composta da 0001 —
  // é o que torna rodar o job duas vezes seguidas idêntico a rodar uma vez.
  // Em lotes de 1000: um único upsert com 10 mil linhas arrisca estourar
  // limite de corpo da requisição.
  for (let inicio = 0; inicio < linhas.length; inicio += TAMANHO_DO_LOTE) {
    const lote = linhas.slice(inicio, inicio + TAMANHO_DO_LOTE)
    const { error } = await db.from('client_cycles').upsert(lote, { onConflict: 'tenant_id,client_id,service_id' })
    if (error) throw new AppError('INTERNAL', { cause: error })
  }

  /*
    Registrar DEPOIS de gravar `client_cycles`, e resolver DEPOIS de registrar.

    A ordem importa: se o registro falhasse antes do upsert, o produto ficaria sem o recálculo (o
    que a tela mostra) por causa da trilha (o que ninguém vê hoje). E resolver antes de registrar
    perderia o caso do cliente que voltou no mesmo dia em que a previsão anterior seria escrita.
  */
  await registrarPrevisoes(db, tenantId, previsoes)

  /*
   * G-05b (docs/60): "cliente_voltou" agregado, não um evento por previsão fechada. Este job
   * processa até 10 mil clientes por tenant em menos de 60s (TICKET-036) — um `product_events`
   * a mais por LAÇO acrescentaria uma escrita por resolução, multiplicada por todo tenant que
   * roda esta rotina toda madrugada. `resolverPrevisoes` já devolve a contagem agregada; um
   * evento por RODADA (não por previsão) é o único formato que não pesa no orçamento do job.
   */
  const fechadas = await resolverPrevisoes(db, tenantId, datasPorCombinacao)
  if (fechadas > 0) await registrarEvento(db, tenantId, 'cliente_voltou', { fechadas })

  await calibrarServicos(db, tenantId, cycleDaysPorServico)

  return linhas.length
}

/**
 * "Recalcula em tempo real quando um atendimento é concluído" (§5.3) — só a
 * combinação daquele agendamento, não o tenant inteiro. Chamada por quem
 * conclui (TICKET-024), depois que o `done` já está gravado.
 */
export async function recomputarCicloDeUmAtendimento(
  db: Cliente,
  tenantId: string,
  timezone: string,
  combinacao: Combinacao,
  today: string,
): Promise<void> {
  const [concluidos, futuros, servico, assinatura, pacotes] = await Promise.all([
    db
      .from('appointments')
      .select('starts_at, professional_id')
      .eq('tenant_id', tenantId)
      .eq('client_id', combinacao.clientId)
      .eq('service_id', combinacao.serviceId)
      .eq('status', 'done'),
    db
      .from('appointments')
      .select('id', { head: true, count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('client_id', combinacao.clientId)
      .eq('service_id', combinacao.serviceId)
      .in('status', ['pending', 'confirmed', 'arrived']),
    db.from('services').select('cycle_days, cycle_days_observado, price_cents').eq('id', combinacao.serviceId).maybeSingle(),
    // Mesmo motivo do job noturno (`docs/DECISOES.md` 2026-09-18): assinante ativo não gera venda
    // avulsa. Consulta indexada por `client_subscriptions_uma_ativa` (0019) — tão barata quanto a
    // contagem de `futuros` acima, sem o custo que já manteve a calibração de probabilidade fora
    // deste caminho síncrono (comentário abaixo).
    db
      .from('client_subscriptions')
      .select('id', { head: true, count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('client_id', combinacao.clientId)
      .eq('status', 'active'),
    // Mesmo motivo, terceiro mecanismo (`docs/DECISOES.md` 2026-09-18): pacote com sessão sobrando
    // NESTE serviço. `used_sessions < total_sessions` não tem operador PostgREST — comparado em
    // memória abaixo, sobre no máximo um punhado de linhas por (cliente, serviço).
    db
      .from('packages')
      .select('total_sessions, used_sessions')
      .eq('tenant_id', tenantId)
      .eq('client_id', combinacao.clientId)
      .eq('service_id', combinacao.serviceId)
      .or(`expires_on.is.null,expires_on.gte.${today}`),
  ])
  if (concluidos.error) throw new AppError('INTERNAL', { cause: concluidos.error })
  if (futuros.error) throw new AppError('INTERNAL', { cause: futuros.error })
  if (servico.error) throw new AppError('INTERNAL', { cause: servico.error })
  if (assinatura.error) throw new AppError('INTERNAL', { cause: assinatura.error })
  if (pacotes.error) throw new AppError('INTERNAL', { cause: pacotes.error })
  if (!servico.data) return

  const history = (concluidos.data ?? [])
    .map((a) => Temporal.Instant.from(a.starts_at).toZonedDateTimeISO(timezone).toPlainDate())
    .sort((a, b) => Temporal.PlainDate.compare(a, b))
    .map((date) => ({ date }))
  if (history.length === 0) return

  /*
    Mesma conta de lucro esperado do job noturno, pelo mesmo motivo da régua logo abaixo: as duas
    funções escrevem a MESMA linha de `client_cycles`, e uma delas escrever menos colunas que a
    outra deixa o número velho na tabela com cara de recém-calculado.

    O que NÃO é igual, de propósito: `value_at_risk_cents`/`profit_at_risk_cents` aqui usam a
    tabela PADRÃO de `PROBABILIDADE_POR_ESTADO`, não a calibrada do tenant (`docs/73` F1). Esta
    função roda `await`ada dentro de concluir um atendimento — ação síncrona que a pessoa está
    esperando — e ler `cycle_predictions` de novo aqui repetiria a consulta mais cara da tela
    "Recuperar receita" num caminho sensível a latência, pelo mesmo motivo que já mordeu esta
    base (`docs/70`, "Hoje bloqueava por evento de funil"). A diferença que isso produz é
    cosmética — poucos centavos de estimativa — e o job noturno (`recomputarCiclosDoTenant`)
    recalibra todo mundo de qualquer forma na madrugada seguinte. Não é o mesmo risco da régua
    (que decide DATA e ESTADO, visíveis e capazes de oscilar) — é só o valor estimado ao lado.
  */
  const [materialPorServico, comissaoPor] = await Promise.all([
    materialDeCadaServico(db, tenantId, [combinacao.serviceId]),
    comissaoDeCadaProfissional(db, tenantId),
  ])
  const ultimoProfissional = (concluidos.data ?? []).reduce<{ quando: string; id: string | null } | null>(
    (mais, a) => (!mais || a.starts_at > mais.quando ? { quando: a.starts_at, id: a.professional_id } : mais),
    null,
  )?.id ?? null

  const resultado = computeCycle({
    history,
    // A MESMA régua do job noturno. Ler `cycle_days` sozinho aqui fazia concluir um atendimento
    // reverter a previsão para o palpite de catálogo até a madrugada seguinte corrigir.
    defaultCycleDays: reguaEfetivaDias(servico.data.cycle_days, servico.data.cycle_days_observado),
    today: Temporal.PlainDate.from(today),
    hasFutureAppointment: (futuros.count ?? 0) > 0,
  })

  const temPacoteComSaldo = (pacotes.data ?? []).some((p) => p.used_sessions < p.total_sessions)
  const precoEfetivo = (assinatura.count ?? 0) > 0 || temPacoteComSaldo ? 0 : servico.data.price_cents

  const { error } = await db.from('client_cycles').upsert(
    {
      tenant_id: tenantId,
      client_id: combinacao.clientId,
      service_id: combinacao.serviceId,
      personal_cycle_days: Math.round(resultado.personalCycleDays),
      last_visit_on: history[history.length - 1]!.date.toString(),
      predicted_on: resultado.predictedDate.toString(),
      late_days: Math.trunc(resultado.lateDays),
      state: resultado.state,
      value_at_risk_cents: valorEmRiscoCents(precoEfetivo, resultado.state),
      profit_at_risk_cents: lucroEmRiscoCents(
        lucroEsperadoCents({
          priceCents: precoEfetivo,
          commissionBps: comissaoPor(ultimoProfissional, combinacao.serviceId),
          materialCents: materialPorServico.get(combinacao.serviceId) ?? 0,
        }),
        resultado.state,
      ),
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,client_id,service_id' },
  )
  if (error) throw new AppError('INTERNAL', { cause: error })
}

/**
 * O material de cada serviço, uma vez por tenant, a partir da ficha de consumo × custo médio.
 *
 * Uma consulta para o catálogo inteiro, e não uma por serviço dentro do laço: o
 * `recomputarCiclosDoTenant` roda para 10 mil clientes em menos de 60s justamente porque carrega
 * tudo em poucas consultas (TICKET-036).
 */
async function materialDeCadaServico(db: Cliente, tenantId: string, serviceIds: readonly string[]): Promise<Map<string, number>> {
  const material = new Map<string, number>()
  if (serviceIds.length === 0) return material

  const { data, error } = await db
    .from('service_products')
    .select('service_id, qty, products(avg_cost_cents)')
    .eq('tenant_id', tenantId)
    .in('service_id', [...serviceIds])
  if (error) throw new AppError('INTERNAL', { cause: error })

  const fichas = new Map<string, { qty: number; avgCostCents: number }[]>()
  for (const linha of data ?? []) {
    const lista = fichas.get(linha.service_id) ?? []
    lista.push({ qty: linha.qty, avgCostCents: linha.products?.avg_cost_cents ?? 0 })
    fichas.set(linha.service_id, lista)
  }
  for (const [serviceId, ficha] of fichas) material.set(serviceId, custoDoServico(ficha, 1).custoCents)
  return material
}

/**
 * Resolve a comissão de um par (profissional, serviço) com a mesma precedência de
 * `resolverCommissionBps` do fechamento de comanda: o vínculo específico primeiro, o padrão do
 * profissional depois. Sem profissional conhecido, zero — e zero aqui não é chute: é a hipótese
 * mais conservadora para o LUCRO esperado ser o maior possível, e a ordem não depende dela.
 */
async function comissaoDeCadaProfissional(db: Cliente, tenantId: string): Promise<(professionalId: string | null, serviceId: string) => number> {
  const [vinculos, profissionais] = await Promise.all([
    db.from('professional_services').select('professional_id, service_id, commission_bps').eq('tenant_id', tenantId),
    db.from('professionals').select('id, commission_bps').eq('tenant_id', tenantId),
  ])
  if (vinculos.error) throw new AppError('INTERNAL', { cause: vinculos.error })
  if (profissionais.error) throw new AppError('INTERNAL', { cause: profissionais.error })

  const doVinculo = new Map((vinculos.data ?? []).filter((v) => v.commission_bps !== null).map((v) => [`${v.professional_id}:${v.service_id}`, v.commission_bps!]))
  const doProfissional = new Map((profissionais.data ?? []).map((p) => [p.id, p.commission_bps]))

  return (professionalId, serviceId) => {
    if (!professionalId) return 0
    return doVinculo.get(`${professionalId}:${serviceId}`) ?? doProfissional.get(professionalId) ?? 0
  }
}
