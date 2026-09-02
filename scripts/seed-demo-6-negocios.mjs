/**
 * Semeia SEIS negócios fictícios de demonstração: 3 barbearias e 3 salões, cobrindo os quatro
 * degraus de plano, com clientes e histórico inventados.
 *
 *   node scripts/seed-demo-6-negocios.mjs
 *
 * Rodar de novo apaga e recria os seis (o tenant cai por slug, o resto vai no cascade).
 *
 * Os planos são QUATRO (`gratis`, `essencial`, `equipe`, `avancado`), não seis — a distribuição
 * abaixo cobre os quatro e respeita os tetos de `src/core/billing/planos.ts`, que são duros para
 * profissional: `gratis` e `essencial` só permitem UM. Por isso os salões, que têm três
 * profissionais cada, ficam em `equipe` (teto 5) e `avancado` (sem teto) — não é escolha
 * estética, é o que o produto deixa existir.
 *
 * ⚠️ Todo slug daqui precisa estar em `SLUGS_DE_DEMONSTRACAO` (`src/core/tenants/demonstracao.ts`),
 * senão estes negócios inventados entram no sitemap, no robots e nas rotas de lembrete/campanha
 * como se fossem estabelecimento de verdade — alguém acha no Google e marca horário num lugar que
 * não existe. Ver o cabeçalho daquele arquivo.
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

const SENHA = process.env.SEED_SENHA ?? 'DemoCiclo#2026'
const TZ = 'America/Sao_Paulo'
const OFFSET = 3

const NEGOCIOS = [
  {
    slug: 'demo-navalha-de-ouro',
    nome: 'Barbearia Navalha de Ouro',
    vertical: 'barber',
    plano: 'gratis',
    dono: 'Ricardo Alves',
    // `gratis` tem teto de 1 profissional e 50 clientes — o seed respeita os dois.
    equipe: [],
    clientes: 14,
  },
  {
    slug: 'demo-corte-fino',
    nome: 'Barbearia Corte Fino',
    vertical: 'barber',
    plano: 'essencial',
    dono: 'Marcos Tavares',
    equipe: [],
    clientes: 18,
  },
  {
    slug: 'demo-dom-estilo',
    nome: 'Barbearia Dom Estilo',
    vertical: 'barber',
    plano: 'equipe',
    dono: 'Anderson Rocha',
    equipe: [
      { nome: 'Diego Martins', papel: 'Barbeiro', cor: '#22c55e' },
      { nome: 'Felipe Ramos', papel: 'Barbeiro', cor: '#f59e0b' },
    ],
    clientes: 22,
  },
  /*
   * Os três salões têm profissional de unha, cabelo e cílios — mas o pacote de uma vertical só
   * traz os serviços DELA, e `hair` não tem pacote nenhum (só `barber`, `nails`, `lashes`,
   * `brows`, `waxing` e `aesthetics` foram semeados; o enum promete mais). Sem `extras`, a
   * cabeleireira e a lash designer ficariam sem nada para fazer no catálogo.
   */
  {
    slug: 'demo-studio-bella',
    nome: 'Studio Bella',
    vertical: 'nails',
    plano: 'equipe',
    dona: 'Camila Ferraz',
    equipe: [
      { nome: 'Renata Lopes', papel: 'Cabelo', cor: '#ec4899' },
      { nome: 'Priscila Amaral', papel: 'Cílios', cor: '#8b5cf6' },
    ],
    extras: [
      { name: 'Corte feminino', price_cents: 8000, duration_min: 60 },
      { name: 'Escova', price_cents: 6000, duration_min: 45 },
      { name: 'Extensão de cílios', price_cents: 15000, duration_min: 120 },
    ],
    clientes: 24,
  },
  {
    slug: 'demo-salao-encanto',
    nome: 'Salão Encanto',
    vertical: 'aesthetics',
    plano: 'avancado',
    dona: 'Vanessa Prado',
    equipe: [
      { nome: 'Juliana Castro', papel: 'Unhas', cor: '#ec4899' },
      { nome: 'Tatiane Moreira', papel: 'Cílios', cor: '#8b5cf6' },
    ],
    extras: [
      { name: 'Corte feminino', price_cents: 9000, duration_min: 60 },
      { name: 'Coloração', price_cents: 22000, duration_min: 180 },
      { name: 'Manicure', price_cents: 5000, duration_min: 45 },
      { name: 'Extensão de cílios', price_cents: 16000, duration_min: 120 },
    ],
    clientes: 28,
  },
  {
    slug: 'demo-espaco-vitoria',
    nome: 'Espaço Vitória',
    vertical: 'nails',
    plano: 'avancado',
    dona: 'Vitória Nogueira',
    equipe: [
      { nome: 'Larissa Pinto', papel: 'Cabelo', cor: '#ec4899' },
      { nome: 'Bruna Siqueira', papel: 'Cílios', cor: '#8b5cf6' },
    ],
    extras: [
      { name: 'Corte feminino', price_cents: 8500, duration_min: 60 },
      { name: 'Progressiva', price_cents: 25000, duration_min: 180 },
      { name: 'Extensão de cílios', price_cents: 14000, duration_min: 120 },
    ],
    clientes: 26,
  },
]

const NOMES_CLIENTES = [
  'Ana Souza', 'Bianca Melo', 'Carla Nunes', 'Douglas Reis', 'Elaine Prado',
  'Fábio Correia', 'Giovana Lima', 'Heitor Aguiar', 'Isadora Campos', 'João Vitor Silva',
  'Karina Duarte', 'Luiz Otávio Braga', 'Marina Bastos', 'Nelson Ferraz', 'Olívia Rangel',
  'Paulo Menezes', 'Queila Andrade', 'Rafael Pontes', 'Sabrina Teixeira', 'Thiago Barreto',
  'Ursula Vidal', 'Vinícius Almeida', 'Wanda Freitas', 'Xênia Portela', 'Yuri Cardoso',
  'Zilda Moraes', 'Alice Fontes', 'Bruno Salgado',
]

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

async function semear(cfg, indiceNegocio) {
  const email = `dono-${cfg.slug}@ciclo.app`
  const donoNome = cfg.dono ?? cfg.dona

  // ── limpeza (roda de novo sem duplicar)
  const { data: antigo } = await svc.from('tenants').select('id').eq('slug', cfg.slug).maybeSingle()
  if (antigo) await svc.from('tenants').delete().eq('id', antigo.id)
  const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 })
  const usuarioAntigo = lista?.users.find((u) => u.email === email)
  if (usuarioAntigo) await svc.auth.admin.deleteUser(usuarioAntigo.id)

  // ── dono + negócio
  const { data: userData, error: erroUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
    user_metadata: { full_name: donoNome },
  })
  precisa(erroUser, `criar usuário de ${cfg.slug}`)
  const userId = userData.user.id

  const { data: tenant, error: erroTenant } = await svc
    .from('tenants')
    .insert({
      name: cfg.nome,
      slug: cfg.slug,
      vertical: cfg.vertical,
      plan: cfg.plano,
      timezone: TZ,
      phone: `+55119${String(70000000 + indiceNegocio).slice(0, 8)}`,
    })
    .select('id')
    .single()
  precisa(erroTenant, `criar tenant ${cfg.slug}`)
  const tenantId = tenant.id

  precisa((await svc.from('memberships').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' })).error, 'membership')
  precisa((await svc.rpc('apply_vertical_pack', { p_tenant: tenantId, p_vertical: cfg.vertical })).error, `pack de ${cfg.slug}`)

  // ── profissionais: o dono sempre, mais a equipe configurada
  const { data: donoProf, error: erroDono } = await svc
    .from('professionals')
    .insert({ tenant_id: tenantId, user_id: userId, display_name: donoNome, comp_model: 'owner', color: '#14b8a6' })
    .select('id')
    .single()
  precisa(erroDono, 'profissional dono')
  const profissionais = [donoProf.id]

  for (const membro of cfg.equipe) {
    const { data: p, error } = await svc
      .from('professionals')
      .insert({
        tenant_id: tenantId,
        display_name: membro.nome,
        comp_model: 'commission',
        commission_bps: 4000,
        color: membro.cor,
      })
      .select('id')
      .single()
    precisa(error, `profissional ${membro.nome}`)
    profissionais.push(p.id)
  }

  /*
   * O expediente GERAL (`professional_id: null`) precisa existir junto do por-profissional: é ele
   * que a página pública lê para gerar horários. Sem ele o site responde "Sem horários livres"
   * para todos os dias, indistinguível de agenda lotada (medido em 31/08 nos tenants lang-*).
   */
  const expediente = []
  for (const prof of [...profissionais, null]) {
    for (const weekday of [2, 3, 4, 5, 6]) {
      expediente.push({ tenant_id: tenantId, professional_id: prof, weekday, opens_at: '09:00', closes_at: '19:00' })
    }
  }
  await svc.from('business_hours').delete().eq('tenant_id', tenantId)
  precisa((await svc.from('business_hours').insert(expediente)).error, 'expediente')

  if (cfg.extras?.length) {
    precisa(
      (await svc.from('services').insert(cfg.extras.map((s) => ({ ...s, tenant_id: tenantId, active: true })))).error,
      `serviços extras de ${cfg.slug}`,
    )
  }

  const { data: servicos } = await svc
    .from('services')
    .select('id, name, price_cents, duration_min')
    .eq('tenant_id', tenantId)
  if (!servicos?.length) {
    console.error(`nenhum serviço em ${cfg.slug} (vertical ${cfg.vertical} não tem pacote semeado e não há extras)`)
    process.exit(1)
  }

  // ── clientes
  const nomes = NOMES_CLIENTES.slice(0, cfg.clientes)
  const linhas = nomes.map((nome, i) => {
    const cadencia = 21 + (i % 3) * 7
    const ultimaHa = i % 4 === 0 ? cadencia * 3 : i * 2 + 1 // 1 em cada 4 fica atrasado, pro Motor de Ciclo ter o que acusar
    return {
      tenant_id: tenantId,
      name: nome,
      created_at: diasAtras(ultimaHa + 4 * cadencia + 3).toISOString(),
      phone_e164: `+5511${String(93000000 + indiceNegocio * 1000 + i)}`,
      birth_date: `19${85 + (i % 12)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
      tags: i % 4 === 0 ? ['sumido'] : i % 3 === 0 ? ['fiel'] : [],
      source: ['instagram', 'google', 'indicacao'][i % 3],
      marketing_opt_in: true,
      __cadencia: cadencia,
      __ultimaHa: ultimaHa,
      __servico: servicos[i % servicos.length],
    }
  })

  const COLUNAS = ['tenant_id', 'name', 'created_at', 'phone_e164', 'birth_date', 'tags', 'source', 'marketing_opt_in']
  const { data: criados, error: erroClientes } = await svc
    .from('clients')
    .insert(linhas.map((l) => Object.fromEntries(COLUNAS.map((c) => [c, l[c]]))))
    .select('id, name')
  precisa(erroClientes, `clientes de ${cfg.slug}`)
  const idPorNome = Object.fromEntries(criados.map((c) => [c.name, c.id]))

  // ── histórico, encadeado para não violar a trava de sobreposição
  const ocupacao = new Map()
  function proximoSlot(profIdx, data, duracaoMin) {
    const chave = `${profIdx}:${data.toISOString().slice(0, 10)}`
    const inicioMin = ocupacao.get(chave) ?? 9 * 60
    const fimMin = inicioMin + duracaoMin
    if (fimMin > 19 * 60) return null
    ocupacao.set(chave, fimMin + 10)
    const inicio = emSaoPaulo(
      data.getUTCFullYear(),
      data.getUTCMonth() + 1,
      data.getUTCDate(),
      Math.floor(inicioMin / 60),
      inicioMin % 60,
    )
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
  linhas.forEach((cliente, idx) => {
    const servico = cliente.__servico
    const profIdx = idx % profissionais.length
    for (let volta = 4; volta >= 0; volta--) {
      const diasDaVisita = cliente.__ultimaHa + volta * cliente.__cadencia
      if (diasDaVisita > 190) continue
      const data = diasAtras(diasDaVisita)
      // Cadência múltipla de 7 cai sempre no mesmo dia da semana: sem isto, descartar domingo e
      // segunda apagaria o histórico INTEIRO de quem calhou nesses dias.
      while (data.getUTCDay() === 0 || data.getUTCDay() === 1) data.setUTCDate(data.getUTCDate() + 1)
      const slot = reservar(profIdx, data, servico.duration_min)
      if (!slot) continue
      agendamentos.push({
        tenant_id: tenantId,
        client_id: idPorNome[cliente.name],
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

  /*
   * Agenda de hoje e de amanhã, pra tela "Hoje" não nascer vazia.
   *
   * O horário de HOJE é contado a partir de AGORA, não encadeado a partir das 09:00 como o
   * histórico: um agendamento às 09:00 semeado às 15h já nasceu no passado, e a tela "Hoje" só
   * mostra o que ainda vem — a demonstração abria dizendo "Nada mais marcado para hoje", que é o
   * oposto do que ela existe para mostrar. Medido em produção antes de corrigir.
   *
   * Se já for tarde demais para caber antes das 19:00, hoje é pulado e sobra o de amanhã: melhor
   * uma tela honesta de fim de expediente do que um horário impossível.
   */
  const agora = new Date()
  const horaLocalAgora = agora.getUTCHours() - OFFSET
  const proximos = []
  if (horaLocalAgora >= 8 && horaLocalAgora < 17) {
    const hora = Math.min(horaLocalAgora + 2, 18)
    proximos.push({ emDias: 0, hora, status: 'pending' })
  }
  proximos.push({ emDias: 1, hora: 10, status: 'confirmed' })

  proximos.forEach((p, i) => {
    const data = new Date()
    data.setUTCDate(data.getUTCDate() + p.emDias)
    const servico = servicos[i % servicos.length]
    const inicio = emSaoPaulo(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate(), p.hora, 0)
    agendamentos.push({
      tenant_id: tenantId,
      client_id: idPorNome[nomes[i]],
      professional_id: profissionais[i % profissionais.length],
      service_id: servico.id,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + servico.duration_min * 60_000).toISOString(),
      status: p.status,
      origin: 'app',
      price_cents: servico.price_cents,
      ...(p.status === 'confirmed' ? { confirmed_at: new Date().toISOString() } : {}),
    })
  })

  for (let i = 0; i < agendamentos.length; i += 500) {
    precisa((await svc.from('appointments').insert(agendamentos.slice(i, i + 500))).error, `agendamentos de ${cfg.slug}`)
  }

  // ── contadores derivados: quem preenche visits_count/ltv_cents/last_visit_at é cron, e não há
  // cron aqui — sem isto toda tela de CRM nasce zerada e o dado parece falso.
  const { data: concluidos } = await svc
    .from('appointments')
    .select('client_id, price_cents, starts_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'done')
  const porCliente = new Map()
  for (const ag of concluidos ?? []) {
    if (!ag.client_id) continue
    const atual = porCliente.get(ag.client_id) ?? { visitas: 0, ltv: 0, ultima: ag.starts_at }
    atual.visitas++
    atual.ltv += ag.price_cents
    if (ag.starts_at > atual.ultima) atual.ultima = ag.starts_at
    porCliente.set(ag.client_id, atual)
  }
  for (const [clientId, d] of porCliente) {
    await svc.from('clients').update({ visits_count: d.visitas, ltv_cents: d.ltv, last_visit_at: d.ultima }).eq('id', clientId)
  }

  return {
    negocio: cfg.nome,
    plano: cfg.plano,
    site: `/${cfg.slug}`,
    login: email,
    profissionais: profissionais.length,
    clientes: criados.length,
    agendamentos: agendamentos.length,
  }
}

const resultado = []
for (const [i, cfg] of NEGOCIOS.entries()) {
  process.stdout.write(`semeando ${cfg.slug} (${cfg.plano})... `)
  const r = await semear(cfg, i)
  console.log(`ok — ${r.profissionais} prof, ${r.clientes} clientes, ${r.agendamentos} agendamentos`)
  resultado.push(r)
}

console.log('\n' + JSON.stringify({ senhaDeTodos: SENHA, negocios: resultado }, null, 2))
