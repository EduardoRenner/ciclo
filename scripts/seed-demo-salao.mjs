/**
 * Semeia as QUATRO contas de demonstração de salão (docs/112 EXP-S02, `04-salao.md` §5): uma lash
 * autônoma, um salão com equipe, uma esmalteria e uma manicure que atende em casa.
 *
 *   node scripts/seed-demo-salao.mjs
 *   node scripts/seed-demo-dinheiro.mjs demo-carol-cilios demo-salao-encanto demo-esmalteria-rosa-cha demo-ana-paula-unhas
 *   node scripts/seed-demo-agenda-futura.mjs demo-carol-cilios demo-salao-encanto demo-esmalteria-rosa-cha demo-ana-paula-unhas
 *
 * O segundo grava as comandas e roda o Motor (sem ele o Recuperar abre vazio); o terceiro marca os
 * próximos dias. Rodar de novo apaga e recria as quatro (o tenant cai por slug, o resto no cascade).
 *
 * O plano (quem atende quem, o serviço de costume, há quantos dias foi a última visita) vem de
 * `contas-de-salao.mjs`, dado puro que a guarda `seed-de-vitrine-e-coerente` lê. Este arquivo só
 * grava, e no fim CONFERE no banco: nenhum atendimento de serviço fora do ofício da profissional, e
 * a ocupação medida de cada uma dentro da faixa. Fora disso, para com erro antes de virar captura.
 *
 * ⚠️ Todo slug daqui precisa estar em `SLUGS_DE_DEMONSTRACAO` (`src/core/tenants/demonstracao.ts`)
 * ANTES de rodar: este script apaga por slug.
 */
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

import { CONTAS, FAIXA_DE_OCUPACAO, MINUTOS_ABERTOS_POR_SEMANA, planoDeClientes, rnd, servicosDe } from './contas-de-salao.mjs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

// `phone_hash` não é opcional: sem ele o reconhecimento por telefone morre (ver `seed-demo-6-negocios.mjs`).
const SAL_TELEFONE = process.env.PHONE_HASH_SALT ?? env.PHONE_HASH_SALT
if (!SAL_TELEFONE) throw new Error('PHONE_HASH_SALT ausente — sem ele o hash sairia diferente do que o app calcula.')
const hashTelefone = (e164) => createHash('sha256').update(e164 + SAL_TELEFONE, 'utf8').digest('hex')

// Este script APAGA e recria tenants: só no Supabase local, a mesma regra do `db-reset.mjs`.
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  console.error(`RECUSADO — ${env.NEXT_PUBLIC_SUPABASE_URL} não é o Supabase local.`)
  process.exit(1)
}

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Regra 10 do CLAUDE.md: sem `SEED_SENHA`, sorteia. A senha nunca é impressa.
const SENHA = process.env.SEED_SENHA ?? `demo-${randomBytes(9).toString('base64url')}`
const TZ = 'America/Sao_Paulo'
const OFFSET = 3
const TAXAS_DA_MAQUININHA = { cash: 0, pix: 0, debit: 199, credit: 349, other: 0 }
/** Faltas de 8% a 11% (`04-salao.md` §5.3), numa proporção EXATA do histórico. */
// 9% deu 6,8% a 8,2% medido: a última visita nunca falta, e a fração é sobre as outras.
const CHANCE_DE_FALTA = 0.11
/** Quanto do passado vira histórico. */
const JANELA_DIAS = 180
const ABRE = 9 * 60
const FECHA = 19 * 60
const DIAS_ABERTOS = [2, 3, 4, 5, 6]

function precisa(erro, onde) {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? erro)
    process.exit(1)
  }
}

function emSaoPaulo(data, minutoDoDia) {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), Math.floor(minutoDoDia / 60) + OFFSET, minutoDoDia % 60))
}

/** A data LOCAL de hoje (componentes UTC deslocados): depois das 21h o dia UTC já é amanhã. */
const AGORA = new Date()
const HOJE = new Date(AGORA.getTime() - OFFSET * 3_600_000)
function diasAtras(n) {
  const d = new Date(HOJE)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

async function semear(conta, indiceConta) {
  const emails = {
    dono: `dono-${conta.slug}@ciclo.app`,
    profissional: `profissional-${conta.slug}@ciclo.app`,
    recepcao: `recepcao-${conta.slug}@ciclo.app`,
    gerente: `gerente-${conta.slug}@ciclo.app`,
    financeiro: `financeiro-${conta.slug}@ciclo.app`,
  }
  const dona = conta.equipe[0]

  // ── limpeza (roda de novo sem duplicar)
  const { data: antigo } = await svc.from('tenants').select('id').eq('slug', conta.slug).maybeSingle()
  if (antigo) precisa((await svc.from('tenants').delete().eq('id', antigo.id)).error, `apagar ${conta.slug}`)
  const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 })
  for (const u of lista?.users ?? []) {
    if (Object.values(emails).includes(u.email)) await svc.auth.admin.deleteUser(u.id)
  }

  // ── dona + negócio
  const { data: userData, error: erroUser } = await svc.auth.admin.createUser({
    email: emails.dono,
    password: SENHA,
    email_confirm: true,
    user_metadata: { full_name: dona.nome },
  })
  precisa(erroUser, `criar usuária de ${conta.slug}`)
  const userId = userData.user.id

  const { data: tenant, error: erroTenant } = await svc
    .from('tenants')
    .insert({
      name: conta.nome,
      slug: conta.slug,
      vertical: conta.vertical,
      plan: conta.plano,
      timezone: TZ,
      settings: {
        payment_fees_bps: TAXAS_DA_MAQUININHA,
        custo_fixo: { mensal_cents: conta.equipe.length > 1 ? 900_000 : 250_000, horas_por_mes: 200, cadeiras: conta.equipe.length },
        ...(conta.agendaSoDoProfissional ? { restrict_professional_view: true } : {}),
      },
      phone: `+55119${String(71000000 + indiceConta)}`,
    })
    .select('id')
    .single()
  precisa(erroTenant, `criar tenant ${conta.slug}`)
  const tenantId = tenant.id
  precisa((await svc.from('memberships').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' })).error, 'membership')

  // ── serviços, na ordem da conta (`position`): a página pública ordena por ela
  const { data: servicos, error: erroServicos } = await svc
    .from('services')
    .insert(
      conta.servicos.map((s, i) => ({
        tenant_id: tenantId,
        name: s.nome,
        price_cents: s.preco,
        duration_min: s.min,
        cycle_days: s.ritmo ?? 365,
        position: i,
        bookable_online: s.ritmo !== null,
        active: true,
      })),
    )
    .select('id, name')
  precisa(erroServicos, `serviços de ${conta.slug}`)
  const idDoServico = new Map(servicos.map((s) => [s.name, s.id]))

  // ── profissionais e o que cada uma faz
  const profissionais = []
  for (const [i, prof] of conta.equipe.entries()) {
    const { data: p, error } = await svc
      .from('professionals')
      .insert({
        tenant_id: tenantId,
        display_name: prof.nome,
        color: prof.cor,
        ...(i === 0 ? { user_id: userId, comp_model: 'owner' } : { comp_model: 'commission', commission_bps: 4000 }),
      })
      .select('id')
      .single()
    precisa(error, `profissional ${prof.nome}`)
    profissionais.push(p.id)
  }
  const vinculos = conta.equipe.flatMap((prof, i) =>
    servicosDe(conta, prof).map((s) => ({ tenant_id: tenantId, professional_id: profissionais[i], service_id: idDoServico.get(s.nome) })),
  )
  precisa((await svc.from('professional_services').insert(vinculos)).error, 'serviços por profissional')

  const logins = { dono: emails.dono }
  if (conta.equipe.length > 1) {
    const criarLogin = async (email, nome, papel) => {
      const { data, error } = await svc.auth.admin.createUser({ email, password: SENHA, email_confirm: true, user_metadata: { full_name: nome } })
      precisa(error, `login de ${papel} em ${conta.slug}`)
      precisa((await svc.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: papel })).error, `membership ${papel}`)
      return data.user.id
    }
    const idProfissional = await criarLogin(emails.profissional, conta.equipe[1].nome, 'professional')
    precisa((await svc.from('professionals').update({ user_id: idProfissional }).eq('id', profissionais[1])).error, 'ligar login à profissional')
    await criarLogin(emails.recepcao, `Recepção ${conta.nome}`, 'reception')
    await criarLogin(emails.gerente, `Gerência ${conta.nome}`, 'manager')
    await criarLogin(emails.financeiro, `Financeiro ${conta.nome}`, 'finance')
    Object.assign(logins, { profissional: emails.profissional, recepcao: emails.recepcao, gerente: emails.gerente, financeiro: emails.financeiro })
  }

  // Expediente geral (`professional_id: null`) junto do de cada uma: é o que a página pública lê.
  const expediente = [...profissionais, null].flatMap((prof) =>
    DIAS_ABERTOS.map((weekday) => ({ tenant_id: tenantId, professional_id: prof, weekday, opens_at: '09:00', closes_at: '19:00' })),
  )
  precisa((await svc.from('business_hours').insert(expediente)).error, 'expediente')

  // Revenda do salão (`04-salao.md` §5.3). Custo 1950: é por ele que o `seed-demo-dinheiro` acha o
  // item de revenda e o põe em parte das comandas.
  precisa(
    (await svc.from('products').insert({ tenant_id: tenantId, name: conta.revenda, avg_cost_cents: 1950, price_cents: 3500, stock_qty: 24, reorder_point: 6, is_retail: true })).error,
    'produto de revenda',
  )

  // ── clientes
  const plano = planoDeClientes(conta)
  const telefone = (i) => `+55119${60 + indiceConta}${String(i).padStart(6, '0')}`
  const linhas = plano.map((c, i) => {
    const visitas = Math.floor((JANELA_DIAS - c.ultimaHa) / c.servico.ritmo) + 1
    return {
      tenant_id: tenantId,
      name: c.nome,
      created_at: diasAtras(c.ultimaHa + (visitas - 1) * c.servico.ritmo + 5).toISOString(),
      phone_e164: telefone(i),
      phone_hash: hashTelefone(telefone(i)),
      birth_date: `19${80 + (i % 20)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
      tags: c.atraso !== null && c.atraso >= 20 ? ['sumido'] : c.atraso === null && i % 4 === 0 ? ['fiel'] : [],
      source: ['instagram', 'indicacao', 'google', 'whatsapp'][i % 4],
      // Chamar de volta pede consentimento (EXP-A08): parte da carteira não autorizou.
      marketing_opt_in: rnd(conta.slug, i, 'consentimento') < 0.85,
    }
  })
  const idsDosClientes = []
  for (let i = 0; i < linhas.length; i += 500) {
    const { data, error } = await svc.from('clients').insert(linhas.slice(i, i + 500)).select('id')
    precisa(error, `clientes de ${conta.slug}`)
    idsDosClientes.push(...data.map((d) => d.id))
  }

  /*
   * ── histórico: cada cliente volta no ritmo do serviço dela, sempre com a MESMA profissional
   * (é ela que faz o ofício), num dia aberto e numa hora sorteada com semente.
   */
  const ocupacao = new Map()
  function vagaNoDia(profIdx, data, duracaoMin, semente) {
    const chave = `${profIdx}:${data.toISOString().slice(0, 10)}`
    const ocupados = ocupacao.get(chave) ?? []
    const passos = Math.floor((FECHA - duracaoMin - ABRE) / 15) + 1
    const pedido = Math.floor(rnd(semente, 'hora') * passos)
    for (let k = 0; k < passos; k++) {
      const inicioMin = ABRE + ((pedido + k) % passos) * 15
      const fimMin = inicioMin + duracaoMin
      if (ocupados.some(([a, b]) => inicioMin < b && a < fimMin)) continue
      ocupados.push([inicioMin, fimMin])
      ocupacao.set(chave, ocupados)
      return { inicio: emSaoPaulo(data, inicioMin), fim: emSaoPaulo(data, fimMin) }
    }
    return null
  }
  /** O dia aberto mais perto de `n` dias atrás (até 3 para cada lado), sempre no passado. */
  function diaAberto(n, semente) {
    const deslocamentos = [0, 1, -1, 2, -2, 3, -3].sort((a, b) => Math.abs(a) - Math.abs(b) || rnd(semente, a) - rnd(semente, b))
    for (const d of deslocamentos) {
      const dias = n + d
      if (dias >= 1 && DIAS_ABERTOS.includes(diasAtras(dias).getUTCDay())) return dias
    }
    return null
  }

  const agendamentos = []
  plano.forEach((c, idx) => {
    const visitas = Math.floor((JANELA_DIAS - c.ultimaHa) / c.servico.ritmo) + 1
    for (let volta = 0; volta < visitas; volta++) {
      const semente = `${conta.slug}|${c.nome}|${volta}`
      const dias = diaAberto(c.ultimaHa + volta * c.servico.ritmo, semente)
      if (dias === null) continue
      const data = diasAtras(dias)
      const duracao = c.servico.min + (c.extra?.min ?? 0)
      const slot = vagaNoDia(c.profIdx, data, duracao, semente)
      if (!slot) continue
      const partes = c.extra ? [c.servico, c.extra] : [c.servico]
      let inicio = slot.inicio
      for (const s of partes) {
        const fim = new Date(inicio.getTime() + s.min * 60_000)
        agendamentos.push({
          tenant_id: tenantId,
          client_id: idsDosClientes[idx],
          professional_id: profissionais[c.profIdx],
          service_id: idDoServico.get(s.nome),
          starts_at: inicio.toISOString(),
          ends_at: fim.toISOString(),
          status: 'done',
          origin: rnd(semente, 'origem') < 0.55 ? 'public_page' : 'app',
          price_cents: s.preco,
          completed_at: fim.toISOString(),
          __podeFaltar: volta > 0,
          __visita: semente,
        })
        inicio = fim
      }
    }
  })

  // Faltas numa proporção EXATA, por visita (as duas partes do mesmo dia faltam juntas). A última
  // visita nunca é falta: o Motor leria como sumida quem está em dia.
  const visitasQuePodemFaltar = [...new Set(agendamentos.filter((a) => a.__podeFaltar).map((a) => a.__visita))].sort((x, y) => rnd(x, 'falta') - rnd(y, 'falta'))
  const faltou = new Set(visitasQuePodemFaltar.slice(0, Math.round(visitasQuePodemFaltar.length * CHANCE_DE_FALTA)))
  for (const a of agendamentos) {
    if (faltou.has(a.__visita)) {
      a.status = 'no_show'
      delete a.completed_at
    }
    delete a.__podeFaltar
    delete a.__visita
  }

  // ── hoje: 4 a 6 horários por profissional, de clientes DELA; e um amanhã. Domingo e segunda fecha.
  const diaDeHoje = HOJE.getUTCDay()
  if (DIAS_ABERTOS.includes(diaDeHoje)) {
    conta.equipe.forEach((_, profIdx) => {
      const delas = plano.map((c, i) => ({ ...c, i })).filter((c) => c.profIdx === profIdx)
      const quantos = 4 + Math.floor(rnd(conta.slug, profIdx, 'hoje') * 3)
      for (let k = 0; k < quantos; k++) {
        const c = delas[Math.floor(rnd(conta.slug, profIdx, k, 'quem') * delas.length)]
        const slot = vagaNoDia(profIdx, HOJE, c.servico.min, `${conta.slug}|hoje|${profIdx}|${k}`)
        if (!slot) continue
        const terminou = slot.fim <= AGORA
        const status = terminou ? 'done' : rnd(conta.slug, profIdx, k, 'conf') < 0.6 ? 'confirmed' : 'pending'
        agendamentos.push({
          tenant_id: tenantId,
          client_id: idsDosClientes[c.i],
          professional_id: profissionais[profIdx],
          service_id: idDoServico.get(c.servico.nome),
          starts_at: slot.inicio.toISOString(),
          ends_at: slot.fim.toISOString(),
          status,
          origin: k % 2 === 0 ? 'public_page' : 'app',
          price_cents: c.servico.preco,
          ...(terminou ? { completed_at: slot.fim.toISOString() } : {}),
          ...(status === 'confirmed' ? { confirmed_at: AGORA.toISOString() } : {}),
        })
      }
    })
  }

  for (let i = 0; i < agendamentos.length; i += 500) {
    precisa((await svc.from('appointments').insert(agendamentos.slice(i, i + 500))).error, `agendamentos de ${conta.slug}`)
  }

  // ── contadores derivados (quem os preenche é cron, e não há cron aqui)
  const porCliente = new Map()
  for (const ag of agendamentos) {
    if (ag.status !== 'done') continue
    const atual = porCliente.get(ag.client_id) ?? { visitas: 0, ltv: 0, ultima: ag.starts_at }
    atual.visitas++
    atual.ltv += ag.price_cents
    if (ag.starts_at > atual.ultima) atual.ultima = ag.starts_at
    porCliente.set(ag.client_id, atual)
  }
  const atualizacoes = [...porCliente]
  for (let i = 0; i < atualizacoes.length; i += 25) {
    await Promise.all(
      atualizacoes.slice(i, i + 25).map(([id, d]) => svc.from('clients').update({ visits_count: d.visitas, ltv_cents: d.ltv, last_visit_at: d.ultima }).eq('id', id)),
    )
  }

  // ── conferência no BANCO, não no plano
  // Paginado: o PostgREST devolve no máximo 1.000 linhas e a conferência olhava só as primeiras
  // (medido: a ocupação de quem vinha depois saiu 0%).
  const gravados = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await svc.from('appointments').select('professional_id, service_id, starts_at, ends_at, status').eq('tenant_id', tenantId).order('id').range(de, de + 999)
    precisa(error, `ler agendamentos de ${conta.slug}`)
    gravados.push(...data)
    if (data.length < 1000) break
  }
  if (gravados.length !== agendamentos.length) precisa(`gravou ${agendamentos.length} e leu ${gravados.length}`, `conferir ${conta.slug}`)
  const { data: ligados } = await svc.from('professional_services').select('professional_id, service_id').eq('tenant_id', tenantId)
  const pode = new Set((ligados ?? []).map((l) => `${l.professional_id}|${l.service_id}`))
  const cruzamentos = gravados.filter((a) => !pode.has(`${a.professional_id}|${a.service_id}`))
  if (cruzamentos.length) precisa(`${cruzamentos.length} atendimentos de serviço fora do ofício da profissional`, `conferir ${conta.slug}`)

  // Ocupação MEDIDA: minutos marcados nas últimas 8 semanas ÷ minutos abertos.
  const desde = diasAtras(56).toISOString()
  const ocupacaoMedida = conta.equipe.map((prof, i) => {
    const minutos = gravados
      .filter((a) => a.professional_id === profissionais[i] && a.starts_at >= desde && a.starts_at < HOJE.toISOString().slice(0, 10))
      .reduce((s, a) => s + (new Date(a.ends_at) - new Date(a.starts_at)) / 60_000, 0)
    return { nome: prof.nome, pct: Math.round((100 * minutos) / (8 * MINUTOS_ABERTOS_POR_SEMANA)) }
  })
  const foraDaFaixa = ocupacaoMedida.filter((o) => o.pct < FAIXA_DE_OCUPACAO.min || o.pct > FAIXA_DE_OCUPACAO.max)
  if (foraDaFaixa.length) precisa(`ocupação fora de ${FAIXA_DE_OCUPACAO.min}–${FAIXA_DE_OCUPACAO.max}%: ${JSON.stringify(foraDaFaixa)}`, `conferir ${conta.slug}`)

  return {
    negocio: conta.nome,
    plano: conta.plano,
    site: `/${conta.slug}`,
    login: logins,
    clientes: plano.length,
    passaramDoDia: plano.filter((c) => c.atraso !== null).length,
    agendamentos: agendamentos.length,
    ocupacao: ocupacaoMedida,
  }
}

const resultado = []
for (const [i, conta] of CONTAS.entries()) {
  process.stdout.write(`semeando ${conta.slug} (${conta.plano})... `)
  const r = await semear(conta, i)
  console.log(`ok — ${r.clientes} clientes, ${r.passaramDoDia} passaram do dia, ${r.agendamentos} agendamentos, ocupação ${r.ocupacao.map((o) => `${o.nome.split(' ')[0]} ${o.pct}%`).join(', ')}`)
  resultado.push(r)
}

console.log('\n' + JSON.stringify({ contas: resultado }, null, 2))
