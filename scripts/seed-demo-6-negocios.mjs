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

/**
 * `phone_hash` NÃO é opcional: toda busca de cliente por telefone no produto passa por ele.
 * Gravar `phone_e164` sem o hash deixa o reconhecimento morto e faz `agendamentos.ts` tomar 500
 * ao remarcar alguém que JÁ é cliente — falha que só aparece na hora de demonstrar.
 * Idêntico a `hashTelefone` em `src/server/services/telefone.ts`; o sal nunca é impresso.
 */
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

const SENHA = process.env.SEED_SENHA ?? 'DemoCiclo#2026'
const TZ = 'America/Sao_Paulo'
const OFFSET = 3

/** PRNG determinístico (md5 → [0,1)), o mesmo do `seed-demo-dinheiro`: rodar de novo dá o mesmo seed. */
function rnd(...partes) {
  const h = createHash('md5').update(partes.join('|')).digest('hex').slice(0, 12)
  return parseInt(h, 16) / 0xffffffffffff
}

/**
 * APR-037: taxas de maquininha de um negócio comum, para a comanda do seed ter "taxa" e a sobra
 * não ser igual ao faturamento. Pix e dinheiro sem taxa.
 */
const TAXAS_DA_MAQUININHA = { cash: 0, pix: 0, debit: 199, credit: 349, other: 0 }

/** Faltas no histórico: sem elas o comparecimento era 100% e a tela de falta nunca aparecia. */
const CHANCE_DE_FALTA = 0.11

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
    agendaSoDoProfissional: true,
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
    agendaSoDoProfissional: true,
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
  // APR-037: um login por papel nos negócios com equipe — profissional (ligado ao 1º da equipe) e
  // recepção. Sem eles, nada do que muda por papel (Hoje, Caixa, comissão) podia ser visto.
  const emailProfissional = `profissional-${cfg.slug}@ciclo.app`
  const emailRecepcao = `recepcao-${cfg.slug}@ciclo.app`
  const donoNome = cfg.dono ?? cfg.dona

  // ── limpeza (roda de novo sem duplicar)
  const { data: antigo } = await svc.from('tenants').select('id').eq('slug', cfg.slug).maybeSingle()
  if (antigo) await svc.from('tenants').delete().eq('id', antigo.id)
  const { data: lista } = await svc.auth.admin.listUsers({ perPage: 1000 })
  for (const u of lista?.users ?? []) {
    if ([email, emailProfissional, emailRecepcao].includes(u.email)) await svc.auth.admin.deleteUser(u.id)
  }

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
      // APR-037: sem o custo fixo, a sobra das barbearias de um profissional só saía 99% do
      // faturamento. Aluguel e contas como o dono responderia nas três perguntas (`custo-fixo.ts`).
      settings: {
        payment_fees_bps: TAXAS_DA_MAQUININHA,
        custo_fixo: { mensal_cents: cfg.equipe.length ? 650_000 : 280_000, horas_por_mes: 220, cadeiras: 1 + cfg.equipe.length },
        // Os dois jeitos de equipe existem: profissional que vê só a própria agenda (aqui) e que vê
        // a do salão inteiro (o padrão, nos outros). O login de profissional mostra a diferença.
        ...(cfg.agendaSoDoProfissional ? { restrict_professional_view: true } : {}),
      },
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

  const logins = { dono: email }
  if (cfg.equipe.length) {
    const criarLogin = async (emailDoPapel, nome, papel) => {
      const { data, error } = await svc.auth.admin.createUser({
        email: emailDoPapel,
        password: SENHA,
        email_confirm: true,
        user_metadata: { full_name: nome },
      })
      precisa(error, `login de ${papel} em ${cfg.slug}`)
      precisa((await svc.from('memberships').insert({ tenant_id: tenantId, user_id: data.user.id, role: papel })).error, `membership ${papel}`)
      return data.user.id
    }
    const idProfissional = await criarLogin(emailProfissional, cfg.equipe[0].nome, 'professional')
    precisa((await svc.from('professionals').update({ user_id: idProfissional }).eq('id', profissionais[1])).error, 'ligar login ao profissional')
    await criarLogin(emailRecepcao, `Recepção ${cfg.nome}`, 'reception')
    logins.profissional = emailProfissional
    logins.recepcao = emailRecepcao
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
    // 2 em cada 5 ficam atrasados, pro Motor de Ciclo ter o que acusar: com 1 em 4, nenhum negócio
    // chegava a 10 pessoas no Recuperar e a lista nunca era vista cheia (APR-037).
    const atrasado = i % 5 === 0 || i % 5 === 3
    const ultimaHa = atrasado ? cadencia * 3 : i * 2 + 1
    return {
      tenant_id: tenantId,
      name: nome,
      created_at: diasAtras(ultimaHa + 4 * cadencia + 3).toISOString(),
      phone_e164: `+5511${String(93000000 + indiceNegocio * 1000 + i)}`,
      phone_hash: hashTelefone(`+5511${String(93000000 + indiceNegocio * 1000 + i)}`),
      birth_date: `19${85 + (i % 12)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
      tags: atrasado ? ['sumido'] : i % 3 === 0 ? ['fiel'] : [],
      source: ['instagram', 'google', 'indicacao'][i % 3],
      marketing_opt_in: true,
      __cadencia: cadencia,
      __ultimaHa: ultimaHa,
      __servico: servicos[i % servicos.length],
    }
  })

  const COLUNAS = ['tenant_id', 'name', 'created_at', 'phone_e164', 'phone_hash', 'birth_date', 'tags', 'source', 'marketing_opt_in']
  const { data: criados, error: erroClientes } = await svc
    .from('clients')
    .insert(linhas.map((l) => Object.fromEntries(COLUNAS.map((c) => [c, l[c]]))))
    .select('id, name')
  precisa(erroClientes, `clientes de ${cfg.slug}`)
  const idPorNome = Object.fromEntries(criados.map((c) => [c.name, c.id]))

  /*
   * ── histórico, sem violar a trava de sobreposição
   *
   * APR-037: a 1ª versão encadeava cada dia a partir das 09:00 e empurrava domingo e segunda para a
   * terça. Medido: até 91% dos horários às 9h e 51–62% numa terça — Hoje, Mês e qualquer gráfico
   * por hora mostravam um negócio que não existe. Agora cada visita pede uma hora sorteada (com
   * semente) e procura a primeira vaga dali em diante, e cai num dia útil em RODÍZIO (no máximo 3
   * dias antes ou depois da cadência). Sorteio puro não bastou: cadência múltipla de 7 prende cada
   * cliente num dia da semana, e com 14 a 28 clientes a soma saía 31–35% num dia só (medido).
   */
  const ABRE = 9 * 60
  const FECHA = 19 * 60
  const ocupacao = new Map()
  function vagaNoDia(profIdx, data, duracaoMin, semente) {
    const chave = `${profIdx}:${data.toISOString().slice(0, 10)}`
    const ocupados = ocupacao.get(chave) ?? []
    const passos = Math.floor((FECHA - duracaoMin - ABRE) / 30) + 1
    if (passos <= 0) return null
    const pedido = Math.floor(rnd(semente, 'hora') * passos)
    for (let k = 0; k < passos; k++) {
      const inicioMin = ABRE + ((pedido + k) % passos) * 30
      const fimMin = inicioMin + duracaoMin
      if (ocupados.some(([a, b]) => inicioMin < b + 10 && a < fimMin + 10)) continue
      ocupados.push([inicioMin, fimMin])
      ocupacao.set(chave, ocupados)
      const inicio = emSaoPaulo(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate(), Math.floor(inicioMin / 60), inicioMin % 60)
      return { inicio, fim: new Date(inicio.getTime() + duracaoMin * 60_000) }
    }
    return null
  }
  function reservar(profPreferido, data, duracaoMin, semente) {
    for (let salto = 0; salto < profissionais.length; salto++) {
      const idx = (profPreferido + salto) % profissionais.length
      const slot = vagaNoDia(idx, data, duracaoMin, semente)
      if (slot) return { ...slot, profIdx: idx }
    }
    return null
  }
  /** Desloca até 3 dias para cair no dia útil `alvo` (2 = terça … 6 = sábado), sempre no passado. */
  function diasAtrasNoDia(diasDaVisita, alvo) {
    let delta = alvo - diasAtras(diasDaVisita).getUTCDay()
    if (delta > 3) delta -= 7
    if (delta < -3) delta += 7
    if (diasDaVisita - delta < 1) delta -= 7
    return diasDaVisita - delta
  }

  const agendamentos = []
  linhas.forEach((cliente, idx) => {
    const servico = cliente.__servico
    const profIdx = idx % profissionais.length
    for (let volta = 4; volta >= 0; volta--) {
      const semente = `${cfg.slug}|${cliente.name}|${volta}`
      const diasDaVisita = diasAtrasNoDia(cliente.__ultimaHa + volta * cliente.__cadencia, 2 + ((idx + volta) % 5))
      if (diasDaVisita > 190) continue
      const data = diasAtras(diasDaVisita)
      const slot = reservar(profIdx, data, servico.duration_min, semente)
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
        __podeFaltar: volta > 0,
        __semente: semente,
      })
    }
  })

  // Faltas numa proporção EXATA do histórico, escolhidas por semente. Sorteio visita a visita deu
  // 98% de comparecimento num negócio de 14 clientes e 87% noutro (medido). A última visita de
  // cada cliente nunca é falta: o Motor leria como sumido quem está em dia.
  const podemFaltar = agendamentos.filter((a) => a.__podeFaltar).sort((x, y) => rnd(x.__semente, 'falta') - rnd(y.__semente, 'falta'))
  for (const a of podemFaltar.slice(0, Math.round(podemFaltar.length * CHANCE_DE_FALTA))) {
    a.status = 'no_show'
    delete a.completed_at
  }
  for (const a of agendamentos) {
    delete a.__podeFaltar
    delete a.__semente
  }

  /*
   * ── dia de hoje CHEIO (APR-037), e um horário amanhã
   *
   * Cada profissional tem 4 a 6 horários hoje, espalhados no expediente. O que já terminou está
   * concluído (e ganha comanda no `seed-demo-dinheiro`); o que vem está confirmado ou pendente.
   * Antes era UM horário hoje — a Hoje nunca foi vista como num dia de trabalho. Domingo e segunda
   * o negócio está fechado: aí fica só o de amanhã, que é o honesto.
   */
  const agora = new Date()
  // A data LOCAL de hoje (componentes UTC deslocados): depois das 21h o dia UTC já é amanhã.
  const hoje = new Date(agora.getTime() - OFFSET * 3_600_000)
  const diaDeHoje = hoje.getUTCDay()
  if (diaDeHoje !== 0 && diaDeHoje !== 1) {
    let vez = 0
    profissionais.forEach((_, profIdx) => {
      const quantos = 4 + Math.floor(rnd(cfg.slug, profIdx, 'hoje') * 3)
      for (let k = 0; k < quantos; k++) {
        const nome = nomes[(vez * 3 + profIdx) % nomes.length]
        const servico = servicos[vez % servicos.length]
        vez++
        const slot = vagaNoDia(profIdx, hoje, servico.duration_min, `${cfg.slug}|hoje|${profIdx}|${k}`)
        if (!slot) continue
        const terminou = slot.fim <= agora
        const status = terminou ? 'done' : rnd(cfg.slug, profIdx, k, 'conf') < 0.6 ? 'confirmed' : 'pending'
        agendamentos.push({
          tenant_id: tenantId,
          client_id: idPorNome[nome],
          professional_id: profissionais[profIdx],
          service_id: servico.id,
          starts_at: slot.inicio.toISOString(),
          ends_at: slot.fim.toISOString(),
          status,
          origin: k % 2 === 0 ? 'public_page' : 'app',
          price_cents: servico.price_cents,
          ...(terminou ? { completed_at: slot.fim.toISOString() } : {}),
          ...(status === 'confirmed' ? { confirmed_at: agora.toISOString() } : {}),
        })
      }
    })
  }
  const amanha = new Date(hoje)
  amanha.setUTCDate(amanha.getUTCDate() + 1)
  const servicoDeAmanha = servicos[0]
  const inicioDeAmanha = emSaoPaulo(amanha.getUTCFullYear(), amanha.getUTCMonth() + 1, amanha.getUTCDate(), 10, 0)
  agendamentos.push({
    tenant_id: tenantId,
    client_id: idPorNome[nomes[0]],
    professional_id: profissionais[0],
    service_id: servicoDeAmanha.id,
    starts_at: inicioDeAmanha.toISOString(),
    ends_at: new Date(inicioDeAmanha.getTime() + servicoDeAmanha.duration_min * 60_000).toISOString(),
    status: 'confirmed',
    origin: 'app',
    price_cents: servicoDeAmanha.price_cents,
    confirmed_at: agora.toISOString(),
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
    login: logins,
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

// A senha não é impressa: é a de `SEED_SENHA` (ou a padrão de demonstração, só local).
console.log('\n' + JSON.stringify({ negocios: resultado }, null, 2))
