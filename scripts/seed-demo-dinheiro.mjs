/**
 * Preenche a CAMADA DE DINHEIRO das barbearias de demonstração: uma comanda fechada
 * por atendimento concluído, com item de serviço, comissão, custo de material, desconto e gorjeta
 * ocasionais — mais fila de espera, avaliações e pacotes vendidos.
 *
 *   node scripts/seed-demo-dinheiro.mjs                 # dom-rocha + teste-* + lang-barber
 *   node scripts/seed-demo-dinheiro.mjs dom-rocha       # so uma
 *
 * Roda de novo apaga as comandas que ele criou (por `appointment_id` dos atendimentos do tenant)
 * e recria. NÃO mexe em `appointments`, `clients` nem `stock_moves`.
 *
 * ── Por que as contas são reescritas aqui, e não deixadas para o app ────────────────────────────
 *
 * `caixa.ts` soma faturamento e lucro direto de `tickets` (status `closed`/`paid`), não de
 * `payments` — então o que a tela "Caixa" mostra depende SÓ de os totais do ticket estarem certos.
 * As fórmulas abaixo espelham `src/core/comanda/totals.ts` linha a linha:
 *
 *   total_item     = max(0, round(qty × preço) − desconto_item)
 *   comissão_item  = round(total_item × bps / 10000)            (base bruta; tenant sem commission_base)
 *   subtotal       = Σ total_item
 *   total          = max(0, subtotal − desconto_comanda) + gorjeta
 *   material       = Σ custo_item   (de service_products: qty × avg_cost_cents)
 *   profit         = max(0, subtotal − desconto_comanda) − material − taxa − comissão
 *
 * Gorjeta entra no `total` (a cliente paga) mas fica 100% do profissional (F84): não entra em
 * `profit` nem em base de comissão. Desconto da comanda é concessão do dono: sai do `profit`
 * inteiro, mas a comissão é sobre o total do item, sem ele.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const URL_SUPABASE = process.env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL
const svc = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
console.log(`escrevendo em ${new URL(URL_SUPABASE).host}`)

function precisa(erro, onde) {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? JSON.stringify(erro))
    process.exit(1)
  }
}

/** PRNG determinístico a partir de uma string (md5 → [0,1)). Mesma ideia do seed SQL: reproduzível. */
function rnd(...partes) {
  const h = createHash('md5').update(partes.join('|')).digest('hex').slice(0, 12)
  return parseInt(h, 16) / 0xffffffffffff
}
const escolha = (semente, arr) => arr[Math.floor(rnd(semente) * arr.length)]

const ALVO_PADRAO = ['dom-rocha', 'teste-essencial', 'teste-equipe', 'teste-avancado', 'lang-barber']
const alvo = process.argv.slice(2).length ? process.argv.slice(2) : ALVO_PADRAO
const { data: tenantsAlvo } = await svc.from('tenants').select('id, slug').in('slug', alvo)
if (!tenantsAlvo?.length) precisa({ message: `nenhum tenant para: ${alvo.join(', ')}` }, 'achar tenants')

for (const tnt of tenantsAlvo) {
  const T = tnt.id
  const slug = tnt.slug

  const { data: dono } = await svc.from('memberships').select('user_id').eq('tenant_id', T).eq('role', 'owner').single()
  const { data: servicos } = await svc.from('services').select('id, name, price_cents').eq('tenant_id', T)
  const { data: profs } = await svc.from('professionals').select('id, commission_bps').eq('tenant_id', T)
  const { data: vinculos } = await svc.from('service_products').select('service_id, product_id, qty').eq('tenant_id', T)
  const { data: produtos } = await svc.from('products').select('id, avg_cost_cents').eq('tenant_id', T)

  const bpsPorProf = new Map(profs.map((p) => [p.id, p.commission_bps ?? 0]))
  const custoPorProduto = new Map(produtos.map((p) => [p.id, p.avg_cost_cents ?? 0]))
  const precoPorServico = new Map(servicos.map((s) => [s.id, s.price_cents]))
  const nomePorServico = new Map(servicos.map((s) => [s.id, s.name]))
  const materialPorServico = new Map()
  for (const v of vinculos) {
    const soma = (materialPorServico.get(v.service_id) ?? 0) + Math.round(Number(v.qty) * (custoPorProduto.get(v.product_id) ?? 0))
    materialPorServico.set(v.service_id, soma)
  }

  // Pomada modeladora é o único produto de revenda plausível na cadeira (custo 1950). Preço de
  // balcão redondo, margem de varejo de barbearia.
  const POMADA = produtos.find((p) => custoPorProduto.get(p.id) === 1950)
  const PRECO_POMADA = 3500

  const { data: atendimentos, error: ea } = await svc
    .from('appointments')
    .select('id, client_id, professional_id, service_id, starts_at')
    .eq('tenant_id', T)
    .eq('status', 'done')
    .not('client_id', 'is', null)
    .lte('starts_at', new Date().toISOString())
    .order('starts_at')
  precisa(ea, 'buscar atendimentos concluídos')

  // Idempotência: este seed é o dono da camada de dinheiro da conta de demonstração, então
  // derruba TODAS as comandas do tenant — inclusive as poucas que outros seeds deixaram com a
  // fórmula de lucro antiga (pré-`calcularSobraDaComanda`), que falhavam a conferência do fim.
  const { data: ticketsAntigos } = await svc.from('tickets').select('id').eq('tenant_id', T)
  if (ticketsAntigos?.length) {
    const ids = ticketsAntigos.map((t) => t.id)
    for (let i = 0; i < ids.length; i += 200) {
      const lote = ids.slice(i, i + 200)
      await svc.from('ticket_items').delete().in('ticket_id', lote)
      await svc.from('payments').delete().in('ticket_id', lote)
      await svc.from('tickets').delete().in('id', lote)
    }
    console.log(`removidas ${ids.length} comandas de uma rodada anterior`)
  }

  const tickets = []
  const itens = []
  let semServico = 0

  for (const a of atendimentos) {
    const preco = precoPorServico.get(a.service_id)
    if (preco == null) {
      semServico++
      continue
    }
    const bps = bpsPorProf.get(a.professional_id) ?? 0
    const ticketId = crypto.randomUUID()

    const linhas = []
    // Linha do serviço.
    const descServico = rnd(a.id, 'desc') < 0.12 ? Math.round(preco * escolha(`${a.id}dv`, [0.1, 0.15, 0.2]) / 100) * 100 : 0
    const totalServico = Math.max(0, preco - descServico)
    linhas.push({
      service_id: a.service_id,
      description: nomePorServico.get(a.service_id),
      qty: 1,
      unit_price_cents: preco,
      discount_cents: descServico,
      total_cents: totalServico,
      commission_bps: bps,
      commission_cents: Math.round((totalServico * bps) / 10_000),
      cost_cents: materialPorServico.get(a.service_id) ?? 0,
    })

    // Revenda de pomada em ~11% das comandas (nunca no platinado, que é outro contexto).
    if (POMADA && preco < 10_000 && rnd(a.id, 'pomada') < 0.11) {
      linhas.push({
        product_id: POMADA.id,
        description: 'Pomada modeladora',
        qty: 1,
        unit_price_cents: PRECO_POMADA,
        discount_cents: 0,
        total_cents: PRECO_POMADA,
        commission_bps: 0,
        commission_cents: 0,
        cost_cents: POMADA.avg_cost_cents ?? 1950,
      })
    }

    const subtotal = linhas.reduce((s, l) => s + l.total_cents, 0)
    const descComanda = rnd(a.id, 'descc') < 0.08 ? escolha(`${a.id}dc`, [500, 1000, 1500]) : 0
    const gorjeta = rnd(a.id, 'tip') < 0.22 ? escolha(`${a.id}tv`, [300, 500, 500, 1000, 1500]) : 0
    const material = linhas.reduce((s, l) => s + l.cost_cents, 0)
    const comissao = linhas.reduce((s, l) => s + l.commission_cents, 0)
    const receitaSalao = Math.max(0, subtotal - descComanda)
    const profit = receitaSalao - material - 0 - comissao
    const total = receitaSalao + gorjeta

    tickets.push({
      id: ticketId,
      tenant_id: T,
      client_id: a.client_id,
      appointment_id: a.id,
      professional_id: a.professional_id,
      status: 'closed',
      subtotal_cents: subtotal,
      discount_cents: descComanda,
      tip_cents: gorjeta,
      total_cents: total,
      material_cost_cents: material,
      fee_cents: 0,
      commission_cents: comissao,
      profit_cents: profit,
      closed_at: a.starts_at,
      created_by: dono?.user_id ?? null,
      created_at: a.starts_at,
    })
    for (const l of linhas) itens.push({ tenant_id: T, ticket_id: ticketId, professional_id: a.professional_id, ...l })
  }

  for (let i = 0; i < tickets.length; i += 400) {
    precisa((await svc.from('tickets').insert(tickets.slice(i, i + 400))).error, `inserir tickets ${i}`)
  }
  for (let i = 0; i < itens.length; i += 400) {
    precisa((await svc.from('ticket_items').insert(itens.slice(i, i + 400))).error, `inserir ticket_items ${i}`)
  }
  console.log(`[${slug}] ${tickets.length} comandas, ${itens.length} itens${semServico ? ` (${semServico} sem serviço)` : ''}`)

  // ── Fila de espera ────────────────────────────────────────────────────────────────────────────
  const { data: clientes } = await svc.from('clients').select('id').eq('tenant_id', T).order('created_at').limit(60)
  await svc.from('waitlist').delete().eq('tenant_id', T)
  const agora = Date.now()
  const espera = []
  for (let i = 0; i < 9; i++) {
    const cli = clientes[Math.floor(rnd('w', i) * clientes.length)]
    const servico = servicos[Math.floor(rnd('ws', i) * servicos.length)]
    const notificado = i < 2 // dois já foram avisados de um horário que abriu
    espera.push({
      tenant_id: T,
      client_id: cli.id,
      service_id: servico.id,
      professional_id: rnd('wp', i) < 0.4 ? profs[Math.floor(rnd('wpp', i) * profs.length)].id : null,
      earliest_at: new Date(agora + 86_400_000).toISOString(),
      latest_at: new Date(agora + 14 * 86_400_000).toISOString(),
      period_of_day: escolha(`wper${i}`, ['morning', 'afternoon', null]),
      weekdays: rnd('wwd', i) < 0.5 ? [escolha(`wd${i}`, [1, 2, 3, 4, 5, 6])] : null,
      notified_at: notificado ? new Date(agora - 3_600_000).toISOString() : null,
      created_at: new Date(agora - (i + 1) * 3 * 86_400_000).toISOString(),
    })
  }
  precisa((await svc.from('waitlist').insert(espera)).error, 'inserir waitlist')
  console.log(`  ${espera.length} na fila de espera`)

  // ── Avaliações ────────────────────────────────────────────────────────────────────────────────
  const COMENTARIOS = [
    'Atendimento impecável, saí no horário certinho.',
    'Melhor que já fiz na cidade.',
    'Ambiente tranquilo, saiu tudo como pedi.',
    'Rápido e bem feito, voltarei.',
    'Profissionais atenciosos, recomendo.',
    null,
    null,
    'Marquei pelo site em 30 segundos, sem ligar pra ninguém.',
    'Gostei bastante, só achei a espera um pouco longa.',
  ]
  const { data: concluidosParaNota } = await svc
    .from('appointments')
    .select('id, client_id')
    .eq('tenant_id', T)
    .eq('status', 'done')
    .not('client_id', 'is', null)
    .order('starts_at', { ascending: false })
    .limit(120)
  const { data: notasExistentes } = await svc.from('client_reviews').select('appointment_id').eq('tenant_id', T)
  const jaTem = new Set((notasExistentes ?? []).map((n) => n.appointment_id))
  const notas = []
  for (const ap of concluidosParaNota) {
    if (jaTem.has(ap.id) || notas.length >= 28) continue
    if (rnd(ap.id, 'temnota') > 0.32) continue
    const nota = rnd(ap.id, 'estrelas') < 0.82 ? 5 : rnd(ap.id, 'estrelas2') < 0.7 ? 4 : 3
    notas.push({
      tenant_id: T,
      appointment_id: ap.id,
      client_id: ap.client_id,
      rating: nota,
      comment: nota >= 4 ? escolha(`cmt${ap.id}`, COMENTARIOS) : 'Deu pra resolver, mas esperei bastante.',
    })
  }
  if (notas.length) precisa((await svc.from('client_reviews').insert(notas)).error, 'inserir avaliações')
  console.log(`  ${notas.length} avaliações novas`)

  // ── Pacotes vendidos ──────────────────────────────────────────────────────────────────────────
  const BARBA = servicos.find((s) => s.name === 'Barba')
  const CORTE = servicos.find((s) => s.name === 'Corte')
  const planos = [
    { servico: BARBA, total: 4, preco: 12000 },
    { servico: CORTE, total: 5, preco: 18000 },
    { servico: CORTE, total: 10, preco: 34000 },
  ]
  const { data: pacotesExistentes } = await svc.from('packages').select('client_id, service_id').eq('tenant_id', T)
  const chavesPacote = new Set((pacotesExistentes ?? []).map((p) => `${p.client_id}:${p.service_id}`))
  const pacotes = []
  for (let i = 0; i < 6; i++) {
    const cli = clientes[Math.floor(rnd('pk', i) * clientes.length)]
    const plano = planos[i % planos.length]
    const chave = `${cli.id}:${plano.servico.id}`
    if (chavesPacote.has(chave)) continue
    chavesPacote.add(chave)
    const usadas = Math.floor(rnd('pku', i) * (plano.total - 1))
    pacotes.push({
      tenant_id: T,
      client_id: cli.id,
      service_id: plano.servico.id,
      total_sessions: plano.total,
      used_sessions: usadas,
      paid_cents: plano.preco,
      expires_on: new Date(agora + 120 * 86_400_000).toISOString().slice(0, 10),
      created_at: new Date(agora - Math.floor(rnd('pkc', i) * 60 + 5) * 86_400_000).toISOString(),
    })
  }
  if (pacotes.length) precisa((await svc.from('packages').insert(pacotes)).error, 'inserir pacotes')
  console.log(`  ${pacotes.length} pacotes vendidos`)

  // ── Conferência ───────────────────────────────────────────────────────────────────────────────
  const { data: conf } = await svc
    .from('tickets')
    .select('subtotal_cents, discount_cents, tip_cents, total_cents, material_cost_cents, fee_cents, commission_cents, profit_cents, closed_at')
    .eq('tenant_id', T)
  const agoraIso = new Date().toISOString()
  let erros = 0
  let receita = 0
  let lucro = 0
  for (const t of conf) {
    const receitaSalao = Math.max(0, t.subtotal_cents - t.discount_cents)
    const profitEsperado = receitaSalao - t.material_cost_cents - t.fee_cents - t.commission_cents
    const totalEsperado = receitaSalao + t.tip_cents
    if (t.profit_cents !== profitEsperado) erros++
    if (t.total_cents !== totalEsperado) erros++
    if (t.closed_at > agoraIso) erros++
    if (t.profit_cents > t.total_cents) erros++
    receita += receitaSalao
    lucro += t.profit_cents
  }
  console.log(`  faturamento R$ ${(receita / 100).toFixed(2)} \u00b7 lucro R$ ${(lucro / 100).toFixed(2)} (${receita ? ((lucro / receita) * 100).toFixed(0) : 0}%)`)
  if (erros) {
    console.error(`\n✗ [${slug}] ${erros} inconsistências`)
    process.exit(1)
  }
  console.log(`  ✓ [${slug}] consistente: profit = fórmula do core, total = receita + gorjeta, nada no futuro`)

}
