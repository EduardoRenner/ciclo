/**
 * ADITIVO: engorda a carteira do `dom-rocha` para o tamanho de uma barbearia de 3 cadeiras de
 * verdade, sem apagar nada.
 *
 *   node scripts/seed-demo-dom-rocha-carteira.mjs
 *
 * O `dom-rocha` tinha 46 clientes e ~10 cortes por semana (o dobro vira ~33) — uma barbearia com três profissionais
 * abertos seis dias por semana faz de 40 a 80. A agenda parecia a de um negócio fechando.
 *
 * Este script NÃO toca em nenhum cliente ou agendamento existente. Ele só:
 *   1. cria ~160 clientes novos, com telefone + hash e um PERFIL DE FREQUÊNCIA (semanal, quinzenal,
 *      mensal, esporádico, sumido, novo) — a distribuição achatada de "5 a 7 visitas para todo
 *      mundo" era o que denunciava o seed;
 *   2. gera o histórico `done` de cada um no ritmo do seu perfil, ~5 meses para trás, dentro do
 *      horário e sem sobreposição por profissional;
 *   3. recalcula `visits_count` / `ltv_cents` / `last_visit_at` só dos clientes que ele criou.
 *
 * DEPOIS de rodar, rode nesta ordem para as camadas derivadas acompanharem:
 *   node scripts/seed-demo-dinheiro.mjs dom-rocha
 *   node scripts/seed-demo-agenda-futura.mjs dom-rocha
 *   (e o recompute de ciclos — tests/integration, como no cabeçalho de seed-demo-barbearia.mjs)
 *
 * Rodar de novo é idempotente: os clientes deste script têm `source = 'seed-carteira'` e telefone
 * na faixa +5511993…, então ele apaga só os seus antes de recriar.
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
const SAL = process.env.PHONE_HASH_SALT ?? env.PHONE_HASH_SALT
if (!SAL) throw new Error('PHONE_HASH_SALT ausente')
const svc = createClient(URL_SUPABASE, process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
console.log(`escrevendo em ${new URL(URL_SUPABASE).host}`)

const precisa = (e, onde) => {
  if (e) {
    console.error(`falhou em ${onde}:`, e.message ?? JSON.stringify(e))
    process.exit(1)
  }
}
const rnd = (...p) => parseInt(createHash('md5').update(p.join('|')).digest('hex').slice(0, 12), 16) / 0xffffffffffff
const pick = (sem, arr) => arr[Math.floor(rnd(sem) * arr.length)]
const hashTelefone = (e164) => createHash('sha256').update(e164 + SAL, 'utf8').digest('hex')

const NOMES = [
  'Adriano', 'Alan', 'Alexandre', 'André', 'Anderson', 'Antônio', 'Bernardo', 'Caio', 'Cauã', 'César',
  'Daniel', 'Danilo', 'Davi', 'Denis', 'Douglas', 'Edson', 'Emerson', 'Enzo', 'Fábio', 'Fernando',
  'Flávio', 'Gustavo', 'Heitor', 'Hugo', 'Ícaro', 'Jonas', 'Jorge', 'Kaique', 'Leandro', 'Lucas',
  'Luiz', 'Marcelo', 'Marcos', 'Mateus', 'Murilo', 'Nícolas', 'Otávio', 'Paulo', 'Pedro', 'Rafael',
  'Renan', 'Ricardo', 'Roberto', 'Rodrigo', 'Samuel', 'Sérgio', 'Thiago', 'Vinícius', 'Vitor', 'Wesley',
  'Camila', 'Fernanda', 'Juliana', 'Larissa', 'Patrícia', 'Renata', 'Sabrina', 'Tatiane',
]
const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Rodrigues', 'Almeida', 'Nascimento',
  'Carvalho', 'Araújo', 'Ribeiro', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Cardoso', 'Teixeira', 'Moreira',
  'Correia', 'Dias', 'Cavalcante', 'Freitas', 'Vieira', 'Monteiro', 'Melo', 'Pinto', 'Moura', 'Cunha',
]
const FONTES = ['instagram', 'indicacao', 'google', 'passou_na_frente', 'indicacao', 'instagram']

// perfil: [peso, cadênciaDias(min,max), visitasAlvo(min,max), últimaVisitaHáDias(min,max), tag]
const PERFIS = {
  semanal: [12, [10, 15], [14, 22], [2, 12], 'fiel'],
  quinzenal: [32, [16, 24], [9, 14], [4, 20], 'fiel'],
  mensal: [28, [28, 40], [5, 8], [8, 35], null],
  esporadico: [14, [55, 90], [2, 3], [20, 70], null],
  sumido: [8, [20, 30], [3, 5], [75, 140], 'sumido'],
  novo: [16, [0, 0], [1, 1], [2, 22], 'novo'],
}

const T_ID = '47762865-e93f-4fa8-a2ea-58795fa8cf32'
const { data: tenant } = await svc.from('tenants').select('id').eq('slug', 'dom-rocha').single()
const T = tenant.id
const OFFSET_H = 3
const HOJE = new Date()
const diasAtras = (n) => new Date(HOJE.getTime() - n * 86_400_000)

const { data: servicos } = await svc.from('services').select('id, name, duration_min, price_cents').eq('tenant_id', T).eq('active', true)
const { data: profs } = await svc.from('professionals').select('id, display_name').eq('tenant_id', T).eq('active', true)
const owner = profs.find((p) => /rocha/i.test(p.display_name)) ?? profs[0]

// Peso dos serviços e da cadeira: o dono pega mais gente.
const SORTEIO_SERVICO = []
const PESOS_SERVICO = { Corte: 40, 'Corte + barba': 28, Barba: 16, 'Corte infantil': 10, Pigmentação: 4, Platinado: 2 }
for (const s of servicos) for (let i = 0; i < (PESOS_SERVICO[s.name] ?? 6); i++) SORTEIO_SERVICO.push(s)
const SORTEIO_PROF = []
for (const p of profs) for (let i = 0; i < (p.id === owner.id ? 5 : 3); i++) SORTEIO_PROF.push(p)

const QTD = 160
const perfisSorteio = []
for (const [nome, [peso]] of Object.entries(PERFIS)) for (let i = 0; i < peso; i++) perfisSorteio.push(nome)

// Idempotência: derruba só os clientes deste script (e o histórico deles vai no cascade de FK? não —
// appointments não cascateiam de clients; apaga na mão).
const { data: meus } = await svc.from('clients').select('id').eq('tenant_id', T).eq('source', 'seed-carteira')
if (meus?.length) {
  const ids = meus.map((c) => c.id)
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    await svc.from('tickets').delete().eq('tenant_id', T).in('client_id', lote)
    await svc.from('appointments').delete().eq('tenant_id', T).in('client_id', lote)
    await svc.from('client_cycles').delete().eq('tenant_id', T).in('client_id', lote)
    await svc.from('clients').delete().in('id', lote)
  }
  console.log(`removidos ${ids.length} clientes de uma rodada anterior`)
}

const clientes = []
for (let i = 0; i < QTD; i++) {
  const perfil = pick(`perfil${i}`, perfisSorteio)
  const [, , , , tagBase] = PERFIS[perfil]
  const nome = `${pick(`n${i}`, NOMES)} ${pick(`sn${i}`, SOBRENOMES)}`
  const tel = `+5511993${String(1 + i).padStart(6, '0')}`
  const anoNasc = 1968 + Math.floor(rnd('nasc', i) * 40)
  const mes = 1 + Math.floor(rnd('mes', i) * 12)
  const dia = 1 + Math.floor(rnd('dia', i) * 28)
  clientes.push({
    __perfil: perfil,
    __i: i,
    __servicoPrimario: pick(`sp${i}`, SORTEIO_SERVICO),
    tenant_id: T,
    name: nome,
    phone_e164: tel,
    phone_hash: hashTelefone(tel),
    birth_date: `${anoNasc}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    source: 'seed-carteira',
    tags: tagBase ? [tagBase] : [],
    marketing_opt_in: rnd('opt', i) < 0.75,
  })
}

const COLUNAS = ['tenant_id', 'name', 'phone_e164', 'phone_hash', 'birth_date', 'source', 'tags', 'marketing_opt_in']
const { data: criados, error: ec } = await svc
  .from('clients')
  .insert(clientes.map((c) => Object.fromEntries(COLUNAS.map((k) => [k, c[k]]))))
  .select('id, phone_e164')
precisa(ec, 'inserir clientes')
const idPorTel = new Map(criados.map((c) => [c.phone_e164, c.id]))

// ── Histórico ────────────────────────────────────────────────────────────────────────────────
const horas = { ab: 9, fe: 20 }
const agendamentos = []
const derivado = new Map() // clientId -> {visitas, ltv, ultima, noShow}

for (const c of clientes) {
  const clientId = idPorTel.get(c.phone_e164)
  const [, [cadMin, cadMax], [visMin, visMax], [ultMin, ultMax]] = PERFIS[c.__perfil]
  const cadencia = c.__perfil === 'novo' ? 30 : cadMin + Math.floor(rnd('cad', c.__i) * (cadMax - cadMin + 1))
  const alvo = visMin + Math.floor(rnd('vis', c.__i) * (visMax - visMin + 1))
  let ultimaHa = ultMin + Math.floor(rnd('ult', c.__i) * (ultMax - ultMin + 1))

  const stats = { visitas: 0, ltv: 0, ultima: null, noShow: 0 }
  for (let v = 0; v < alvo; v++) {
    const diasDaVisita = ultimaHa + v * cadencia
    if (diasDaVisita > 200) break
    const servico = rnd(`svp${c.__i}${v}`, 'x') < 0.8 ? c.__servicoPrimario : pick(`sv${c.__i}${v}`, SORTEIO_SERVICO)
    const prof = pick(`pf${c.__i}${v}`, SORTEIO_PROF)
    const data = diasAtras(diasDaVisita)
    const dow = data.getUTCDay()
    if (dow === 0 || dow === 1) continue // fechado dom/seg
    const minutoLocal = horas.ab * 60 + Math.floor(rnd(`hr${c.__i}${v}`, 'x') * ((horas.fe - 1) * 60 - horas.ab * 60))
    const start = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 0, 0) + (minutoLocal + OFFSET_H * 60) * 60_000)
    const end = new Date(start.getTime() + servico.duration_min * 60_000)

    // 6% viram falta.
    const falta = rnd(`ns${c.__i}${v}`, 'x') < 0.06
    agendamentos.push({
      tenant_id: T,
      client_id: clientId,
      professional_id: prof.id,
      service_id: servico.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: falta ? 'no_show' : 'done',
      origin: rnd(`or${c.__i}${v}`, 'x') < 0.5 ? 'public_page' : 'app',
      price_cents: servico.price_cents,
      created_at: diasAtras(diasDaVisita + 2).toISOString(),
    })
    if (falta) stats.noShow++
    else {
      stats.visitas++
      stats.ltv += servico.price_cents
      const iso = start.toISOString()
      if (!stats.ultima || iso > stats.ultima) stats.ultima = iso
    }
  }
  derivado.set(clientId, stats)
}

for (let i = 0; i < agendamentos.length; i += 500) {
  precisa((await svc.from('appointments').insert(agendamentos.slice(i, i + 500))).error, `inserir agendamentos ${i}`)
}

// ── Denormalizados dos clientes criados ──────────────────────────────────────────────────────
let semVisita = 0
for (const [clientId, st] of derivado) {
  if (st.visitas === 0) semVisita++
  await svc
    .from('clients')
    .update({ visits_count: st.visitas, ltv_cents: st.ltv, last_visit_at: st.ultima, no_show_count: st.noShow })
    .eq('id', clientId)
    .eq('tenant_id', T)
}

// `created_at` do cliente logo antes da primeira visita dele (senão "cadastro" fica hoje e a
// coluna novos_mes estoura).
for (const [clientId, st] of derivado) {
  if (!st.ultima) continue
  const { data: primeira } = await svc
    .from('appointments')
    .select('starts_at')
    .eq('tenant_id', T)
    .eq('client_id', clientId)
    .order('starts_at')
    .limit(1)
    .maybeSingle()
  if (primeira) {
    const antes = new Date(new Date(primeira.starts_at).getTime() - (2 + Math.floor(Math.random() * 6)) * 86_400_000)
    await svc.from('clients').update({ created_at: antes.toISOString() }).eq('id', clientId).eq('tenant_id', T)
  }
}

// ── Conferência de agregado ─────────────────────────────────────────────────────────────────
const { data: todosDone } = await svc.from('appointments').select('starts_at, status').eq('tenant_id', T).eq('status', 'done')
const semana = {}
for (const a of todosDone) {
  const d = new Date(a.starts_at)
  const wk = `${d.getUTCFullYear()}-${String(Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / (7 * 86_400_000))).padStart(2, '0')}`
  semana[wk] = (semana[wk] ?? 0) + 1
}
const semanasCheias = Object.values(semana).filter((n) => n > 3)
const mediaSemana = semanasCheias.reduce((s, n) => s + n, 0) / (semanasCheias.length || 1)

const { data: dist } = await svc.from('clients').select('visits_count').eq('tenant_id', T)
const vs = dist.map((c) => c.visits_count).sort((a, b) => a - b)

console.log('')
console.log(`+${clientes.length} clientes, +${agendamentos.length} agendamentos históricos`)
console.log(`clientes agora: ${dist.length} · sem nenhuma visita: ${semVisita}`)
console.log(`visitas/cliente: min ${vs[0]} · p25 ${vs[Math.floor(vs.length * 0.25)]} · mediana ${vs[Math.floor(vs.length / 2)]} · p75 ${vs[Math.floor(vs.length * 0.75)]} · max ${vs[vs.length - 1]}`)
console.log(`atendimentos/semana (média das semanas cheias): ${mediaSemana.toFixed(0)}`)

if (mediaSemana < 20 || mediaSemana > 120) {
  console.error(`\n✗ ${mediaSemana.toFixed(0)}/semana está fora da faixa plausível para 3 cadeiras (20–120) — revise`)
  process.exit(1)
}
if (vs[Math.floor(vs.length * 0.25)] === vs[Math.floor(vs.length * 0.75)]) {
  console.error('\n✗ distribuição de visitas achatada (p25 == p75) — o defeito que este script existe para tirar')
  process.exit(1)
}
console.log('\n✓ agregado plausível: volume semanal na faixa de 3 cadeiras, visitas com dispersão real')
console.log('\nagora rode: node scripts/seed-demo-dinheiro.mjs dom-rocha  &&  node scripts/seed-demo-agenda-futura.mjs dom-rocha')
