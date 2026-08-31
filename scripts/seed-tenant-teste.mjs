/**
 * Semeia um tenant de teste PEQUENO (não confundir com `dom-rocha`, que é a demonstração pública)
 * com dono, alguns profissionais, um punhado de clientes com histórico e uma assinatura. Existe
 * para testar telas de CRM/Motor de Ciclo em `lang-barber` e `lang-unhas` sem repetir à mão o
 * cadastro manual. Ambos já estão em `SLUGS_DE_DEMONSTRACAO` (`src/core/tenants/demonstracao.ts`),
 * então não vazam para sitemap/robots/reminders/campaigns reais.
 *
 *   node scripts/seed-tenant-teste.mjs lang-barber barber "Lang Barber" "dono-lang-barber@ciclo.app"
 *   node scripts/seed-tenant-teste.mjs lang-unhas nails "Lang Unhas" "dona-lang-unhas@ciclo.app"
 *
 * Rodar de novo apaga e recria (o tenant cai por slug, o resto vai no cascade).
 */
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

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const [, , SLUG, VERTICAL, NOME, EMAIL] = process.argv
if (!SLUG || !VERTICAL || !NOME || !EMAIL) {
  console.error('Uso: node scripts/seed-tenant-teste.mjs <slug> <vertical> "<nome>" "<email>"')
  process.exit(1)
}

const SENHA = process.env.SEED_SENHA ?? 'teste-ciclo-2026'
const TZ = 'America/Sao_Paulo'
const OFFSET = 3

function precisa(erro, onde) {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? erro)
    process.exit(1)
  }
}

function emSaoPaulo(ano, mes, dia, hora, minuto = 0) {
  return new Date(Date.UTC(ano, mes - 1, dia, hora + OFFSET, minuto))
}

function diasAtras(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// ─────────────────────────────────────────────────────────────── limpeza

const { data: antigo } = await svc.from('tenants').select('id').eq('slug', SLUG).maybeSingle()
if (antigo) {
  await svc.from('tenants').delete().eq('id', antigo.id)
  console.log('tenant anterior apagado')
}
const { data: listaUsuarios } = await svc.auth.admin.listUsers({ perPage: 1000 })
const usuarioAntigo = listaUsuarios?.users.find((u) => u.email === EMAIL)
if (usuarioAntigo) await svc.auth.admin.deleteUser(usuarioAntigo.id)

// ─────────────────────────────────────────────────────────────── negócio

const { data: userData, error: erroUser } = await svc.auth.admin.createUser({
  email: EMAIL,
  password: SENHA,
  email_confirm: true,
  user_metadata: { full_name: NOME },
})
precisa(erroUser, 'criar usuário')
const userId = userData.user.id

const { data: tenant, error: erroTenant } = await svc
  .from('tenants')
  .insert({
    name: NOME,
    slug: SLUG,
    vertical: VERTICAL,
    timezone: TZ,
    phone: '+5511990000000',
    address: 'Rua de Teste, 100 — São Paulo/SP',
  })
  .select('id')
  .single()
precisa(erroTenant, 'criar tenant')
const tenantId = tenant.id

await svc.from('memberships').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' })
precisa((await svc.rpc('apply_vertical_pack', { p_tenant: tenantId, p_vertical: VERTICAL })).error, 'pack')

const { data: donoProf } = await svc
  .from('professionals')
  .insert({ tenant_id: tenantId, user_id: userId, display_name: NOME, comp_model: 'owner', color: '#8b5cf6' })
  .select('id')
  .single()

const { data: outroProf } = await svc
  .from('professionals')
  .insert({ tenant_id: tenantId, display_name: 'Assistente Teste', comp_model: 'commission', commission_bps: 4000, color: '#22c55e' })
  .select('id')
  .single()
const profissionais = [donoProf.id, outroProf.id]

const expediente = []
for (const prof of profissionais) {
  for (const weekday of [2, 3, 4, 5, 6]) {
    expediente.push({ tenant_id: tenantId, professional_id: prof, weekday, opens_at: '09:00', closes_at: '19:00' })
  }
}
/*
 * O expediente GERAL (`professional_id: null`) precisa existir junto: é ele que a página pública
 * lê (`listarExpediente(svc, tenantId, null)`) para saber o horário de funcionamento e gerar
 * slots. A primeira versão deste script apagava o que o `apply_vertical_pack` tinha criado e
 * recriava só o por-profissional — o resultado era uma página que respondia "Sem horários livres
 * nesse dia" para TODOS os dias, indistinguível de agenda lotada. Medido em 31/08 nos dois
 * tenants lang-*.
 */
for (const weekday of [2, 3, 4, 5, 6]) {
  expediente.push({ tenant_id: tenantId, professional_id: null, weekday, opens_at: '09:00', closes_at: '19:00' })
}
await svc.from('business_hours').delete().eq('tenant_id', tenantId)
precisa((await svc.from('business_hours').insert(expediente)).error, 'expediente')

const { data: servicos } = await svc.from('services').select('id, name, price_cents, duration_min').eq('tenant_id', tenantId)
if (!servicos || servicos.length === 0) {
  console.error('pack não criou nenhum serviço — confira o nome da vertical')
  process.exit(1)
}
const servico1 = servicos[0]
const servico2 = servicos[Math.min(1, servicos.length - 1)]

// ─────────────────────────────────────────────────────────────── clientes (12, o bastante pra CRM/Motor de Ciclo terem o que mostrar sem virar outra demo cheia)

const NOMES = [
  'Ana Souza', 'Bianca Melo', 'Carla Nunes', 'Douglas Reis', 'Elaine Prado',
  'Fábio Correia', 'Giovana Lima', 'Heitor Aguiar', 'Isadora Campos', 'João Vitor Silva',
  'Karina Duarte', 'Luiz Otávio Braga',
]

const linhasClientes = NOMES.map((nome, i) => {
  const cadencia = 21 + (i % 3) * 7
  const ultimaHa = i % 4 === 0 ? cadencia * 3 : i * 2 + 1 // 1 em cada 4 fica "atrasado" pro Motor de Ciclo acusar
  const tags = i % 4 === 0 ? ['sumido'] : i % 3 === 0 ? ['fiel'] : []
  const primeiraVisitaHa = ultimaHa + 4 * cadencia
  return {
    tenant_id: tenantId,
    name: nome,
    created_at: diasAtras(primeiraVisitaHa + 3).toISOString(),
    phone_e164: `+5511992${String(200000 + i).padStart(6, '0')}`,
    birth_date: `1985-${String(((i % 12) + 1)).padStart(2, '0')}-15`,
    tags,
    source: ['instagram', 'google', 'indicacao'][i % 3],
    marketing_opt_in: true,
    __cadencia: cadencia,
    __ultimaHa: ultimaHa,
    __servico: i % 2 === 0 ? servico1 : servico2,
  }
})

const COLUNAS_CLIENTE = ['tenant_id', 'name', 'created_at', 'phone_e164', 'birth_date', 'tags', 'source', 'marketing_opt_in']
const { data: clientesCriados, error: erroClientes } = await svc
  .from('clients')
  .insert(linhasClientes.map((l) => Object.fromEntries(COLUNAS_CLIENTE.map((c) => [c, l[c]]))))
  .select('id, name')
precisa(erroClientes, 'criar clientes')
const idPorNome = Object.fromEntries(clientesCriados.map((c) => [c.name, c.id]))

// ─────────────────────────────────────────────────────────────── histórico de atendimentos

const ocupacao = new Map()
function proximoSlot(profIdx, data, duracaoMin) {
  const chave = `${profIdx}:${data.toISOString().slice(0, 10)}`
  const inicioMin = ocupacao.get(chave) ?? 9 * 60
  const fimMin = inicioMin + duracaoMin
  if (fimMin > 19 * 60) return null
  ocupacao.set(chave, fimMin + 10)
  const inicio = emSaoPaulo(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate(), Math.floor(inicioMin / 60), inicioMin % 60)
  return { inicio, fim: new Date(inicio.getTime() + duracaoMin * 60_000) }
}
function reservar(profPreferido, data, duracaoMin) {
  for (let salto = 0; salto < profissionais.length; salto++) {
    const idx = (profPreferido + salto) % profissionais.length
    const slot = proximoSlot(idx, data, duracaoMin)
    if (slot) return { ...slot, profIdx: idx }
  }
  return null
}

const agendamentos = []
linhasClientes.forEach((cliente, idx) => {
  const clientId = idPorNome[cliente.name]
  const servico = cliente.__servico
  const profIdx = idx % profissionais.length
  for (let volta = 4; volta >= 0; volta--) {
    const diasAtrasDaVisita = cliente.__ultimaHa + volta * cliente.__cadencia
    if (diasAtrasDaVisita > 190) continue
    const data = diasAtras(diasAtrasDaVisita)
    while (data.getUTCDay() === 0 || data.getUTCDay() === 1) data.setUTCDate(data.getUTCDate() + 1)
    const slot = reservar(profIdx, data, servico.duration_min)
    if (!slot) continue
    agendamentos.push({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: profissionais[slot.profIdx],
      service_id: servico.id,
      starts_at: slot.inicio.toISOString(),
      ends_at: slot.fim.toISOString(),
      status: 'done',
      origin: idx % 2 === 0 ? 'public_page' : 'app',
      price_cents: servico.price_cents,
      completed_at: slot.fim.toISOString(),
    })
  }
})

// Agenda de hoje/amanhã pra tela "Hoje" não nascer vazia.
;[0, 1].forEach((emDias, i) => {
  const data = new Date()
  data.setUTCDate(data.getUTCDate() + emDias)
  const nome = NOMES[i]
  const slot = reservar(i % profissionais.length, data, servico1.duration_min)
  if (!slot) return
  agendamentos.push({
    tenant_id: tenantId,
    client_id: idPorNome[nome],
    professional_id: profissionais[slot.profIdx],
    service_id: servico1.id,
    starts_at: slot.inicio.toISOString(),
    ends_at: slot.fim.toISOString(),
    status: 'confirmed',
    origin: 'app',
    price_cents: servico1.price_cents,
    confirmed_at: new Date().toISOString(),
  })
})

for (let i = 0; i < agendamentos.length; i += 500) {
  precisa((await svc.from('appointments').insert(agendamentos.slice(i, i + 500))).error, `agendamentos lote ${i}`)
}

// ─────────────────────────────────────────────────────────────── plano de assinatura + 1 cliente assinante

const { data: plano, error: erroPlano } = await svc
  .from('subscription_plans')
  .insert({ tenant_id: tenantId, name: 'Plano Teste', price_cents: 9990, sessions_per_month: 2, benefits: 'Plano de teste para exercitar assinatura.' })
  .select('id')
  .single()
precisa(erroPlano, 'criar plano de assinatura')
precisa(
  (
    await svc.from('client_subscriptions').insert({
      tenant_id: tenantId,
      client_id: idPorNome[NOMES[0]],
      plan_id: plano.id,
      billing_day: 10,
    })
  ).error,
  'assinar cliente',
)

// ─────────────────────────────────────────────────────────────── números derivados (visits_count/ltv_cents/last_visit_at são cron; sem isso a ficha nasce zerada)

const { data: concluidos } = await svc.from('appointments').select('client_id, price_cents, starts_at').eq('tenant_id', tenantId).eq('status', 'done')
const porCliente = new Map()
for (const ag of concluidos ?? []) {
  if (!ag.client_id) continue
  const atual = porCliente.get(ag.client_id) ?? { visitas: 0, ltv: 0, ultima: ag.starts_at }
  atual.visitas++
  atual.ltv += ag.price_cents
  if (ag.starts_at > atual.ultima) atual.ultima = ag.starts_at
  porCliente.set(ag.client_id, atual)
}
for (const [clientId, dados] of porCliente) {
  await svc.from('clients').update({ visits_count: dados.visitas, ltv_cents: dados.ltv, last_visit_at: dados.ultima }).eq('id', clientId)
}

console.log(
  JSON.stringify(
    { ok: true, login: { email: EMAIL, senha: SENHA }, site: `/${SLUG}`, tenantId, clientes: clientesCriados.length, agendamentos: agendamentos.length },
    null,
    2,
  ),
)
