/**
 * Mantém a AGENDA FUTURA das contas de demonstração sempre viva em relação a hoje.
 *
 *   node scripts/seed-demo-agenda-futura.mjs             # todas as contas de demonstração
 *   node scripts/seed-demo-agenda-futura.mjs dom-rocha   # só uma
 *
 * O histórico semeado parou num dia fixo; passadas duas semanas, "Hoje" e "Agenda"
 * abrem VAZIAS — e a agenda é o coração do produto. Este script apaga os agendamentos futuros
 * (pending/confirmed) do tenant e recria os próximos 21 dias, respeitando horário de
 * funcionamento, duração de cada serviço e a trava `appointments_no_overlap` (as cadeias por
 * profissional são sequenciais, nunca colidem).
 *
 * ── O volume sai do PASSADO do próprio negócio, nunca de uma ocupação fixa ─────────────────────
 *
 * Primeira versão enchia ~65% das cadeiras: no `dom-rocha` deu 459 agendamentos futuros para 46
 * clientes — dez cortes por pessoa em três semanas. Cada linha parecia certa e o agregado era
 * impossível, que é o modo de falhar mais caro de um seed (nenhuma tela reclama).
 *
 * Agora a régua é dupla e as duas vêm do tenant:
 *   1. o RITMO — atendimentos concluídos por dia útil nos últimos 90 dias;
 *   2. o TETO POR PESSOA — ninguém volta mais que `MAX_POR_CLIENTE` vezes na janela.
 *
 * E a cota é distribuída por dia com peso decrescente (`PESO_DA_DISTANCIA`) — sem isso ela era
 * gasta inteira no dia 0 e os outros vinte dias abriam vazios, que foi o segundo defeito que
 * apareceu só quando o primeiro foi corrigido.
 *
 * Conta magra fica com agenda magra, e isso é honesto: é o que a base dela sustenta.
 *
 * NÃO mexe em `appointments` passados, `clients`, `tickets` nem `client_cycles`.
 *
 * Rodar de novo é seguro e idempotente. Ideal: um cron semanal, ou rodar antes de cada demo.
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

const precisa = (erro, onde) => {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? JSON.stringify(erro))
    process.exit(1)
  }
}
function rnd(...p) {
  return parseInt(createHash('md5').update(p.join('|')).digest('hex').slice(0, 12), 16) / 0xffffffffffff
}
const pick = (sem, arr) => arr[Math.floor(rnd(sem) * arr.length)]

const SLUGS = [ 'dom-rocha', 'ruivo-barber', 'teste-essencial', 'teste-equipe', 'teste-avancado', 'lang-barber', 'lang-unhas' ]
const OFFSET_H = 3 // America/Sao_Paulo = UTC-3 (sem horário de verão desde 2019)

const DIAS_A_FRENTE = 21
/** Ninguém marca mais que isto em três semanas — a régua que faltava na primeira versão. */
const MAX_POR_CLIENTE = 2
/** Gente marca com pouca antecedência: a semana que vem enche, a terceira fica rala. */
const PESO_DA_DISTANCIA = (d) => (d < 7 ? 1 : d < 14 ? 0.6 : 0.35)

const alvo = process.argv.slice(2).length ? process.argv.slice(2) : SLUGS
const { data: tenants } = await svc.from('tenants').select('id, slug').in('slug', alvo)
if (!tenants?.length) precisa({ message: `nenhum tenant para: ${alvo.join(', ')}` }, 'achar tenants')

for (const tnt of tenants) {
  const T = tnt.id
  const { data: dono } = await svc.from('memberships').select('user_id').eq('tenant_id', T).eq('role', 'owner').maybeSingle()
  const { data: servicos } = await svc.from('services').select('id, name, price_cents, duration_min').eq('tenant_id', T).eq('active', true)
  const { data: profs } = await svc.from('professionals').select('id').eq('tenant_id', T).eq('active', true)
  const { data: horarios } = await svc.from('business_hours').select('weekday, opens_at, closes_at').eq('tenant_id', T)
  const { data: clientes } = await svc.from('clients').select('id').eq('tenant_id', T).is('deleted_at', null)
  const { data: ciclos } = await svc.from('client_cycles').select('client_id, state').eq('tenant_id', T)
  const desde90 = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const { count: concluidos90 } = await svc
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', T)
    .eq('status', 'done')
    .gte('starts_at', desde90)

  // Dias em que a barbearia abre e a janela do dia (pega a linha mais abrangente do weekday).
  const janelaPorDia = new Map()
  for (const h of horarios) {
    const ab = Number(h.opens_at.slice(0, 2))
    const fe = Number(h.closes_at.slice(0, 2))
    const atual = janelaPorDia.get(h.weekday)
    if (!atual || ab < atual.ab || fe > atual.fe) janelaPorDia.set(h.weekday, { ab: Math.min(ab, atual?.ab ?? ab), fe: Math.max(fe, atual?.fe ?? fe) })
  }

  // Clientes que o Motor de Ciclo diz que estão na hora de voltar: são eles que a demonstração quer
  // ver reaparecendo na agenda. 60% dos agendamentos saem daqui, 40% de qualquer cliente ativo.
  const naHora = ciclos.filter((c) => ['due', 'late', 'at_risk'].includes(c.state)).map((c) => c.client_id)
  const todos = clientes.map((c) => c.id)

  // Peso dos serviços: corte é o pão com manteiga; platinado é raro.
  const PESOS = { Corte: 34, 'Corte + barba': 26, Barba: 20, 'Corte infantil': 12, Pigmentação: 6, Platinado: 2 }
  const sorteioServico = []
  for (const s of servicos) for (let i = 0; i < (PESOS[s.name] ?? 8); i++) sorteioServico.push(s)

  // Ritmo real: atendimentos por dia ÚTIL nos últimos 90 dias (≈ 64 dias úteis num calendário
  // de 5 dias abertos por semana). Sem histórico, cai num piso magro em vez de inventar movimento.
  const porDiaUtil = concluidos90 > 0 ? concluidos90 / 64 : 1.5
  // Teto duro: a carteira não sustenta mais que isso, por mais cadeira vazia que exista.
  const cotaTotal = Math.max(4, Math.min(Math.round(porDiaUtil * DIAS_A_FRENTE * (5 / 7)), clientes.length * MAX_POR_CLIENTE))
  const usosPorCliente = new Map()
  let criados = 0

  const hojeBase = new Date()
  const inicio = new Date(Date.UTC(hojeBase.getUTCFullYear(), hojeBase.getUTCMonth(), hojeBase.getUTCDate()))
  const diasAbertos = []
  for (let d = 0; d < DIAS_A_FRENTE; d++) {
    const dia = new Date(inicio.getTime() + d * 86_400_000)
    if (janelaPorDia.get(dia.getUTCDay())) diasAbertos.push(d)
  }
  const somaDosPesos = diasAbertos.reduce((s2, d) => s2 + PESO_DA_DISTANCIA(d), 0) || 1
  const cotaDoDia = new Map(diasAbertos.map((d) => [d, (cotaTotal * PESO_DA_DISTANCIA(d)) / somaDosPesos]))

  const hoje = new Date()
  const hoje0 = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()))

  // Idempotência: remove os futuros ainda em aberto.
  const { error: eDel, count: apagados } = await svc
    .from('appointments')
    .delete({ count: 'exact' })
    .eq('tenant_id', T)
    .in('status', ['pending', 'confirmed'])
    .gte('starts_at', hoje0.toISOString())
  precisa(eDel, 'apagar agenda futura anterior')

  const novos = []
  for (let d = 0; d < DIAS_A_FRENTE; d++) {
    const dia = new Date(hoje0.getTime() + d * 86_400_000)
    const dow = dia.getUTCDay()
    const janela = janelaPorDia.get(dow)
    if (!janela) continue // fechado nesse dia da semana
    // Fração acumulada: um dia de cota 2,4 vira 2 ou 3, e a sobra não se perde ao longo da janela.
    const limiteDoDia = Math.floor(cotaDoDia.get(d) + (rnd('cota', T, d) * 0.999))
    let noDia = 0

    for (const prof of profs) {
      // minuto local corrente na cadeia deste profissional
      let minuto = janela.ab * 60 + Math.floor(rnd('ini', d, prof.id) * 30)
      const fim = janela.fe * 60
      let guarda = 0
      while (minuto < fim - 30 && guarda++ < 40) {
        const ocupa = rnd('ocupa', d, prof.id, minuto) < 0.66
        if (!ocupa) {
          minuto += pick(`gap${d}${prof.id}${minuto}`, [20, 30, 30, 40])
          continue
        }
        const servico = pick(`sv${d}${prof.id}${minuto}`, sorteioServico)
        if (minuto + servico.duration_min > fim) break

        if (criados >= cotaTotal || noDia >= limiteDoDia) break
        const usarCiclo = naHora.length > 0 && rnd('qc', d, prof.id, minuto) < 0.6
        const fonte = (usarCiclo ? naHora : todos).filter((id) => (usosPorCliente.get(id) ?? 0) < MAX_POR_CLIENTE)
        const reserva = todos.filter((id) => (usosPorCliente.get(id) ?? 0) < MAX_POR_CLIENTE)
        const pool = fonte.length ? fonte : reserva
        if (!pool.length) break // toda a carteira já tem o máximo marcado — deixa a cadeira vazia
        const clientId = pick(`cli${d}${prof.id}${minuto}`, pool)
        usosPorCliente.set(clientId, (usosPorCliente.get(clientId) ?? 0) + 1)
        criados++
        noDia++

        const perto = d <= 2
        const status = rnd('st', d, prof.id, minuto) < (perto ? 0.88 : 0.55) ? 'confirmed' : 'pending'
        const online = rnd('or', d, prof.id, minuto) < 0.55
        const startUtc = new Date(dia.getTime() + (minuto + OFFSET_H * 60) * 60_000)
        const endUtc = new Date(startUtc.getTime() + servico.duration_min * 60_000)

        novos.push({
          tenant_id: T,
          client_id: clientId,
          professional_id: prof.id,
          service_id: servico.id,
          starts_at: startUtc.toISOString(),
          ends_at: endUtc.toISOString(),
          status,
          origin: online ? 'public_page' : 'app',
          price_cents: servico.price_cents,
          confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
          created_by: online ? null : (dono?.user_id ?? null),
          created_at: new Date(Date.now() - Math.floor(rnd('ca', d, prof.id, minuto) * 5 + 1) * 86_400_000).toISOString(),
        })
        minuto += servico.duration_min + pick(`lp${d}${prof.id}${minuto}`, [0, 0, 5, 10])
      }
    }
  }

  for (let i = 0; i < novos.length; i += 400) {
    precisa((await svc.from('appointments').insert(novos.slice(i, i + 400))).error, `inserir agendamentos ${i}`)
  }

  // ── Conferência ──────────────────────────────────────────────────────────────────────────────
  const { data: chk } = await svc
    .from('appointments')
    .select('starts_at, ends_at, status, professional_id')
    .eq('tenant_id', T)
    .gte('starts_at', hoje0.toISOString())
    .order('starts_at')
  let foraDoHorario = 0
  let colisoes = 0
  const porProf = new Map()
  for (const a of chk) {
    const h = new Date(new Date(a.starts_at).getTime() - OFFSET_H * 3_600_000).getUTCHours()
    const hFim = new Date(new Date(a.ends_at).getTime() - OFFSET_H * 3_600_000).getUTCHours()
    const min = new Date(new Date(a.ends_at).getTime() - OFFSET_H * 3_600_000).getUTCMinutes()
    if (h < 9 || hFim > 20 || (hFim === 20 && min > 0)) foraDoHorario++
    const lista = porProf.get(a.professional_id) ?? []
    for (const outro of lista) if (a.starts_at < outro.ends_at && outro.starts_at < a.ends_at) colisoes++
    lista.push(a)
    porProf.set(a.professional_id, lista)
  }
  const hojeStr = hoje0.toISOString().slice(0, 10)
  const deHoje = chk.filter((a) => a.starts_at.slice(0, 10) === hojeStr).length
  const dias = new Set(chk.map((a) => a.starts_at.slice(0, 10))).size

  console.log(`\n${apagados ?? 0} futuros antigos apagados, ${novos.length} criados`)
  console.log(`hoje (${hojeStr}): ${deHoje} agendamentos · ${dias} dias com agenda · ${chk.length} no total`)
  if (foraDoHorario || colisoes) {
    console.error(`\n✗ ${foraDoHorario} fora do horário, ${colisoes} colisões — revise`)
    process.exit(1)
  }
  console.log('\n✓ agenda consistente: tudo dentro de 09–20h, nenhuma sobreposição por profissional')

}
