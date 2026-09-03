/**
 * Semeia a barbearia de demonstração — um tenant fictício com 6 meses de história real
 * (clientes fiéis, clientes que sumiram, aniversariantes, faltas, ticket alto) para as telas
 * de CRM nascerem cheias. Nenhum dado de cliente de verdade é tocado.
 *
 *   DEMO_SENHA='...' node scripts/seed-demo-barbearia.mjs
 *
 * Rodar de novo apaga e recria do zero (o tenant cai por slug, o resto vai junto no cascade).
 *
 * DEPOIS DE RODAR, falta o Motor de Ciclo: `client_cycles` é preenchido por um cron que só passa
 * às 3h da manhã no fuso do tenant, então sem forçar o cálculo as telas "Recuperar" e o selo de
 * ciclo da ficha nascem vazias. Como `recomputarCiclosDoTenant` é TypeScript com alias de path
 * (que um `.mjs` solto não resolve), o jeito mais curto é um teste temporário:
 *
 *   1. crie `tests/integration/_ciclos.test.ts` chamando `recalcularSegmentosDoTenant` e
 *      `recomputarCiclosDoTenant` para o tenant de slug `dom-rocha`;
 *   2. `npx vitest run tests/integration/_ciclos.test.ts`;
 *   3. apague o arquivo.
 */
import { createCipheriv, createHash, randomBytes } from 'node:crypto'
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

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SLUG = 'dom-rocha'
const EMAIL = 'dono@barbeariadomrocha.com.br'
/**
 * Regra 10 do CLAUDE.md: segredo nenhum mora no repositório, nem em seed. Defina `DEMO_SENHA`
 * no ambiente para escolher a senha; sem ela, uma é sorteada e impressa no fim da execução.
 */
const SENHA = process.env.DEMO_SENHA ?? `demo-${randomBytes(6).toString('base64url')}`
const TZ = 'America/Sao_Paulo'
/** São Paulo é UTC-3 o ano todo desde 2019 (sem horário de verão) — dá para somar direto. */
const OFFSET = 3

function precisa(erro, onde) {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? erro)
    process.exit(1)
  }
}

/** Mesmo envelope de `src/server/crypto/kek.ts`, reescrito aqui porque o script é JS puro. */
function gerarDekCifrada() {
  const kek = Buffer.from(env.VAULT_KEK, 'base64')
  const iv = randomBytes(12)
  const cifra = createCipheriv('aes-256-gcm', kek, iv)
  const ct = Buffer.concat([cifra.update(randomBytes(32)), cifra.final()])
  const bruto = Buffer.concat([iv, cifra.getAuthTag(), ct])
  return { wrapped: `\\x${bruto.toString('hex')}`, keyVersion: Number(env.VAULT_KEK_VERSION ?? '1') }
}

/** Instante UTC a partir de uma data/hora local de São Paulo. */
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
  user_metadata: { full_name: 'Rafael Rocha' },
})
precisa(erroUser, 'criar usuário')
const userId = userData.user.id

const { data: tenant, error: erroTenant } = await svc
  .from('tenants')
  .insert({
    name: 'Barbearia Dom Rocha',
    slug: SLUG,
    vertical: 'barber',
    timezone: TZ,
    phone: '+5511987654321',
    address: 'Rua Augusta, 1442 — Consolação, São Paulo/SP',
    settings: {
      site: {
        tagline: 'Corte clássico, navalha quente e conversa boa.',
        about:
          'Desde 2015 na Augusta. Aqui ninguém tem pressa: cada corte sai do jeito que você gosta, com toalha quente, navalha e um café na mão. Trabalhamos com hora marcada para você não perder o seu tempo na fila.',
        whatsapp: '+5511987654321',
        instagram: 'barbeariadomrocha',
      },
    },
  })
  .select('id')
  .single()
precisa(erroTenant, 'criar tenant')
const tenantId = tenant.id

await svc.from('memberships').insert({ tenant_id: tenantId, user_id: userId, role: 'owner' })
const { wrapped, keyVersion } = gerarDekCifrada()
await svc.from('tenant_keys').insert({ tenant_id: tenantId, dek_wrapped: wrapped, key_version: keyVersion })
precisa((await svc.rpc('apply_vertical_pack', { p_tenant: tenantId, p_vertical: 'barber' })).error, 'pack')

// O dono já nasce profissional (mesmo caminho do onboarding de verdade).
const { data: donoProf } = await svc
  .from('professionals')
  .insert({ tenant_id: tenantId, user_id: userId, display_name: 'Rafael Rocha', comp_model: 'owner', color: '#f59e0b' })
  .select('id')
  .single()

const { data: outrosProfs } = await svc
  .from('professionals')
  .insert([
    { tenant_id: tenantId, display_name: 'Diego Martins', comp_model: 'commission', commission_bps: 4000, color: '#3b82f6' },
    { tenant_id: tenantId, display_name: 'Léo Ferreira', comp_model: 'commission', commission_bps: 4000, color: '#22c55e' },
  ])
  .select('id')
precisa(!outrosProfs ? 'sem profissionais' : null, 'criar profissionais')
const profissionais = [donoProf.id, ...outrosProfs.map((p) => p.id)]

// Expediente: terça a sábado, 9h às 20h, para o site público ter horário e a agenda abrir slot.
const expediente = []
for (const prof of profissionais) {
  for (const weekday of [2, 3, 4, 5, 6]) {
    expediente.push({ tenant_id: tenantId, professional_id: prof, weekday, opens_at: '09:00', closes_at: '20:00' })
  }
}
for (const weekday of [2, 3, 4, 5, 6]) {
  expediente.push({ tenant_id: tenantId, professional_id: null, weekday, opens_at: '09:00', closes_at: '20:00' })
}
// O pack de vertical já semeia um expediente padrão — troco pelo da barbearia em vez de somar.
await svc.from('business_hours').delete().eq('tenant_id', tenantId)
precisa((await svc.from('business_hours').insert(expediente)).error, 'expediente')

const { data: servicos } = await svc.from('services').select('id, name, price_cents, duration_min').eq('tenant_id', tenantId)
const porNome = Object.fromEntries(servicos.map((s) => [s.name, s]))
const corte = porNome['Corte']
const corteBarba = porNome['Corte + barba']
const barba = porNome['Barba']
const infantil = porNome['Corte infantil']
const platinado = porNome['Platinado']

// ─────────────────────────────────────────────────────────────── clientes

const HOJE = new Date()
const MES_ATUAL = HOJE.getUTCMonth() + 1

/**
 * `cadencia` = de quantos em quantos dias ele volta; `ultimaHa` = há quantos dias foi a última
 * vez. Quem tem `ultimaHa` bem maior que a `cadencia` é exatamente quem o Motor de Ciclo tem
 * que acusar como atrasado — é o que faz a tela "Recuperar" ter o que mostrar na demo.
 */
const CLIENTES = [
  ['Bruno Almeida', '11991110001', corteBarba, 21, 4, ['fiel', 'vip'], { maquina: '2', barba: 'navalha', bebida: 'cerveja' }, 'indicacao', 3, 'Gosta da barba bem alinhada no pescoço. Sempre pede toalha quente.'],
  ['Carlos Eduardo Lima', '11991110002', corte, 21, 9, ['fiel'], { maquina: '1', barba: 'não faz', obs: 'risca do lado esquerdo' }, 'instagram', 5, ''],
  ['Diego Fernandes', '11991110003', corteBarba, 14, 6, ['fiel', 'vip'], { maquina: '0', barba: 'navalha', bebida: 'whisky' }, 'indicacao', 15, 'Cliente desde a inauguração. Chama todo mundo pelo nome.'],
  ['Eduardo Nogueira', '11991110004', corte, 28, 45, [], { maquina: '2', barba: 'máquina' }, 'google', 8, ''],
  ['Felipe Ramos', '11991110005', corteBarba, 21, 3, ['fiel'], { maquina: '1', barba: 'navalha' }, 'passou_na_frente', 22, 'Tem redemoinho na coroa, cuidado ao subir a máquina.'],
  ['Gabriel Souza', '11991110006', corte, 30, 78, ['sumido'], { maquina: '3' }, 'instagram', 11, ''],
  ['Henrique Barros', '11991110007', platinado, 40, 12, ['vip', 'química'], { obs: 'cabelo sensível, já teve reação a pó descolorante' }, 'instagram', 6, 'ALERGIA: pó descolorante comum. Usar linha vegana.'],
  ['Igor Castro', '11991110008', corte, 21, 60, ['sumido'], { maquina: '2', barba: 'não faz' }, 'google', 9, ''],
  ['João Pedro Alves', '11991110009', corteBarba, 21, 7, ['fiel'], { maquina: '1', barba: 'navalha', bebida: 'café' }, 'indicacao', 19, ''],
  ['Kleber Dias', '11991110010', barba, 14, 5, ['barba'], { barba: 'navalha', obs: 'pele sensível, pós-barba sem álcool' }, 'passou_na_frente', 4, 'Pele sensível — sempre bálsamo, nunca loção com álcool.'],
  ['Lucas Martins', '11991110011', corte, 21, 2, ['fiel'], { maquina: '2' }, 'indicacao', 25, ''],
  ['Marcelo Tavares', '11991110012', corteBarba, 21, 90, ['sumido', 'vip'], { maquina: '1', barba: 'navalha' }, 'instagram', 14, 'Era semanal, sumiu depois que mudou de emprego.'],
  ['Nelson Ribeiro', '11991110013', corte, 35, 30, [], { maquina: '3' }, 'google', 7, ''],
  ['Otávio Pinheiro', '11991110014', corteBarba, 21, 1, ['fiel', 'vip'], { maquina: '0', barba: 'navalha', bebida: 'cerveja' }, 'indicacao', 28, ''],
  ['Paulo Henrique Costa', '11991110015', corte, 28, 55, ['sumido'], { maquina: '2' }, 'passou_na_frente', 12, ''],
  ['Rafael Moreira', '11991110016', barba, 14, 8, ['barba', 'fiel'], { barba: 'navalha' }, 'instagram', 3, ''],
  ['Rodrigo Salles', '11991110017', corte, 21, 4, ['fiel'], { maquina: '1', obs: 'não gostou de degradê muito alto da última vez' }, 'indicacao', 17, 'Prefere degradê baixo. Não repetir o alto.'],
  ['Sérgio Antunes', '11991110018', corteBarba, 30, 70, ['sumido'], { maquina: '2', barba: 'máquina' }, 'google', 21, ''],
  ['Thiago Nunes', '11991110019', corte, 21, 6, ['fiel'], { maquina: '2' }, 'instagram', 9, ''],
  ['Vinícius Prado', '11991110020', corteBarba, 21, 11, [], { maquina: '1', barba: 'navalha' }, 'indicacao', 30, ''],
  ['Wagner Lopes', '11991110021', corte, 25, 40, [], { maquina: '3' }, 'google', 2, ''],
  ['André Bittencourt', '11991110022', platinado, 45, 20, ['vip', 'química'], { obs: 'faz platinado desde 2024' }, 'instagram', 26, ''],
  ['Caio Monteiro', '11991110023', corte, 21, 5, ['fiel'], { maquina: '2' }, 'indicacao', 13, ''],
  ['Danilo Freitas', '11991110024', infantil, 25, 14, ['infantil'], { obs: 'filho do Bruno, 7 anos. Vem com tablet.' }, 'indicacao', 18, 'Criança. Deixar o desenho no tablet, corta sem chorar.'],
  ['Emerson Vieira', '11991110025', corte, 21, 85, ['sumido'], { maquina: '1' }, 'passou_na_frente', 1, ''],
  ['Fábio Junqueira', '11991110026', corteBarba, 21, 9, ['fiel'], { maquina: '2', barba: 'navalha' }, 'instagram', 23, ''],
  ['Guilherme Rezende', '11991110027', corte, 28, 33, [], { maquina: '2' }, 'google', 16, ''],
  ['Hugo Bezerra', '11991110028', barba, 14, 3, ['barba', 'fiel'], { barba: 'navalha', bebida: 'café' }, 'indicacao', 27, ''],
  ['Ivan Coelho', '11991110029', corte, 21, 65, ['sumido'], { maquina: '3' }, 'instagram', 10, ''],
  ['Jorge Anselmo', '11991110030', corteBarba, 21, 7, ['fiel', 'vip'], { maquina: '1', barba: 'navalha', bebida: 'whisky' }, 'indicacao', 20, 'Sempre agenda o último horário de sábado.'],
  ['Leandro Pacheco', '11991110031', corte, 30, 48, [], { maquina: '2' }, 'google', 6, ''],
  ['Murilo Aguiar', '11991110032', corte, 21, 2, ['fiel'], { maquina: '0' }, 'instagram', 24, ''],
  ['Nicolas Duarte', '11991110033', infantil, 25, 21, ['infantil'], { obs: '5 anos, primeira vez foi em março' }, 'indicacao', 8, ''],
  ['Orlando Peixoto', '11991110034', corte, 35, 95, ['sumido'], { maquina: '2' }, 'passou_na_frente', 29, ''],
  ['Patrick Villela', '11991110035', corteBarba, 21, 10, [], { maquina: '1', barba: 'máquina' }, 'instagram', 15, ''],
  ['Quirino Santana', '11991110036', barba, 14, 6, ['barba'], { barba: 'navalha' }, 'google', 11, ''],
  ['Renato Cavalcanti', '11991110037', corte, 21, 4, ['fiel'], { maquina: '2' }, 'indicacao', 5, ''],
  ['Samuel Braga', '11991110038', corteBarba, 21, 52, ['sumido'], { maquina: '1', barba: 'navalha' }, 'instagram', 12, ''],
  ['Tarcísio Melo', '11991110039', corte, 28, 8, ['novo'], { maquina: '3' }, 'google', 31, ''],
  ['Ulisses Rocha', '11991110040', corteBarba, 21, 8, ['fiel', 'vip'], { maquina: '0', barba: 'navalha' }, 'indicacao', 7, 'Irmão do dono. Não cobra taxa de sinal.'],
  ['Valter Nascimento', '11991110041', corte, 21, 12, ['novo'], { maquina: '2' }, 'passou_na_frente', 14, ''],
  ['Wesley Aparecido', '11991110042', corte, 30, 72, ['sumido'], { maquina: '1' }, 'instagram', 22, ''],
  ['Yuri Camargo', '11991110043', corteBarba, 21, 5, ['fiel'], { maquina: '2', barba: 'navalha' }, 'indicacao', 9, ''],
  ['Alexandre Furtado', '11991110044', corte, 21, 3, ['fiel', 'novo'], { maquina: '1' }, 'instagram', 2, 'Cliente novo, veio pelo Instagram. Primeira vez em julho.'],
  ['Bernardo Quintela', '11991110045', barba, 14, 9, ['barba'], { barba: 'navalha', obs: 'bigode sempre aparado, nunca raspar' }, 'indicacao', 16, 'NUNCA raspar o bigode. Só aparar.'],
]

const linhasClientes = CLIENTES.map(([nome, tel, servico, cadencia, ultimaHa, tags, prefs, origem, diaAniv, notas]) => {
  // Metade dos aniversários cai no mês corrente de propósito: o segmento "aniversariante" é
  // uma das listas inteligentes e precisa ter gente dentro na hora da demonstração.
  const mesAniv = diaAniv % 2 === 0 ? MES_ATUAL : ((MES_ATUAL + 5) % 12) + 1
  // Cadastrado um pouco antes da primeira visita — sem isso todo mundo nasce "hoje" e o painel
  // anuncia "45 clientes novos este mês", que denuncia o dado de mentira na hora.
  const primeiraVisitaHa = ultimaHa + (tags.includes('novo') ? 0 : 6) * cadencia
  const cadastro = diasAtras(primeiraVisitaHa + 3)

  return {
    tenant_id: tenantId,
    name: nome,
    created_at: cadastro.toISOString(),
    phone_e164: `+55${tel}`,
    phone_hash: hashTelefone(`+55${tel}`),
    // Dia travado em 28 para nenhum mês curto (fevereiro) estourar a data.
    birth_date: `19${70 + (diaAniv % 25)}-${String(mesAniv).padStart(2, '0')}-${String(Math.min(diaAniv, 28)).padStart(2, '0')}`,
    tags,
    preferences: prefs,
    source: origem,
    notes: notas || null,
    marketing_opt_in: true,
    __servico: servico,
    __cadencia: cadencia,
    __ultimaHa: ultimaHa,
  }
})

// `__servico`/`__cadencia`/`__ultimaHa` só existem para gerar o histórico depois; a tabela não
// tem essas colunas. Montar o payload explicitamente é mais claro que desestruturar para
// descartar — e não deixa variável "não usada" espalhada pelo arquivo.
const COLUNAS_CLIENTE = [
  'tenant_id',
  'name',
  'created_at',
  'phone_e164',
  'phone_hash',
  'birth_date',
  'tags',
  'preferences',
  'source',
  'notes',
  'marketing_opt_in',
]

const { data: clientesCriados, error: erroClientes } = await svc
  .from('clients')
  .insert(linhasClientes.map((linha) => Object.fromEntries(COLUNAS_CLIENTE.map((c) => [c, linha[c]]))))
  .select('id, name')
precisa(erroClientes, 'criar clientes')

const idPorNome = Object.fromEntries(clientesCriados.map((c) => [c.name, c.id]))

// Quem veio por indicação aponta para quem indicou — a ficha mostra "indicado por".
const indicadores = ['Bruno Almeida', 'Diego Fernandes', 'Otávio Pinheiro', 'Jorge Anselmo']
const paraIndicar = linhasClientes.filter((c) => c.source === 'indicacao')
for (let i = 0; i < paraIndicar.length; i++) {
  const padrinho = indicadores[i % indicadores.length]
  if (paraIndicar[i].name === padrinho) continue
  await svc.from('clients').update({ referred_by: idPorNome[padrinho] }).eq('id', idPorNome[paraIndicar[i].name])
}

// ─────────────────────────────────────────────────────────────── histórico

const agendamentos = []
/** Uma agenda por profissional/dia, para dois atendimentos nunca caírem no mesmo horário. */
const ocupacao = new Map()

/**
 * Encadeia pelo FIM do atendimento anterior, não por passo fixo. Com passo fixo de 30min um
 * "corte + barba" (60min) invadia o horário seguinte e o banco recusava pela
 * `appointments_no_overlap` — que vale para pending/confirmed, ou seja, justamente a agenda
 * futura da demonstração.
 */
function proximoSlot(profIdx, data, duracaoMin) {
  const chave = `${profIdx}:${data.toISOString().slice(0, 10)}`
  const inicioMin = ocupacao.get(chave) ?? 9 * 60
  const fimMin = inicioMin + duracaoMin
  if (fimMin > 20 * 60) return null
  ocupacao.set(chave, fimMin + 10) // 10min de folga entre um cliente e outro

  const inicio = emSaoPaulo(
    data.getUTCFullYear(),
    data.getUTCMonth() + 1,
    data.getUTCDate(),
    Math.floor(inicioMin / 60),
    inicioMin % 60,
  )
  return { inicio, fim: new Date(inicio.getTime() + duracaoMin * 60_000) }
}

/**
 * Se a agenda do barbeiro preferido lotou naquele dia, tenta os outros antes de desistir — é o
 * que acontece numa barbearia de verdade. Sem isso, 10 clientes ficavam com ficha zerada só
 * porque caíram no mesmo dia cheio do mesmo profissional.
 */
function reservar(profPreferido, data, duracaoMin) {
  for (let salto = 0; salto < profissionais.length; salto++) {
    const idx = (profPreferido + salto) % profissionais.length
    const slot = proximoSlot(idx, data, duracaoMin)
    if (slot) return { ...slot, profIdx: idx }
  }
  return null
}

linhasClientes.forEach((cliente, idx) => {
  const clientId = idPorNome[cliente.name]
  const servico = cliente.__servico
  const profIdx = idx % profissionais.length

  // Cliente marcado como "novo" tem história curta de propósito: é o que faz o painel ter
  // gente de verdade em "novos este mês" em vez de um número redondo e falso.
  const voltasMax = cliente.tags.includes('novo') ? 0 : 6

  // Do mais antigo para o mais recente, respeitando a cadência de cada um.
  for (let volta = voltasMax; volta >= 0; volta--) {
    const diasAtrasDaVisita = cliente.__ultimaHa + volta * cliente.__cadencia
    if (diasAtrasDaVisita > 190) continue

    // Cadência quase sempre é múltiplo de 7 (21 dias, 14 dias...), então TODAS as visitas de um
    // cliente caem no mesmo dia da semana. Descartar domingo/segunda apagava o histórico inteiro
    // de quem calhou nesses dias — 10 clientes ficavam com ficha zerada. Empurra para o próximo
    // dia aberto, que é o que a pessoa faria de verdade.
    const data = diasAtras(diasAtrasDaVisita)
    while (data.getUTCDay() === 0 || data.getUTCDay() === 1) data.setUTCDate(data.getUTCDate() + 1)

    const slot = reservar(profIdx, data, servico.duration_min)
    if (!slot) continue

    // Uma falta aqui e ali: alimenta o score de risco e o contador de no-show da ficha.
    const faltou = idx % 11 === 0 && volta === 2
    agendamentos.push({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: profissionais[slot.profIdx],
      service_id: servico.id,
      starts_at: slot.inicio.toISOString(),
      ends_at: slot.fim.toISOString(),
      status: faltou ? 'no_show' : 'done',
      origin: idx % 3 === 0 ? 'public_page' : 'app',
      price_cents: servico.price_cents,
      completed_at: faltou ? null : slot.fim.toISOString(),
    })
  }
})

// Agenda de hoje e dos próximos dias, para a tela "Hoje" e a agenda não abrirem vazias.
const proximos = [
  ['Bruno Almeida', 0, corteBarba, 'confirmed'],
  ['Otávio Pinheiro', 0, corte, 'confirmed'],
  ['Kleber Dias', 0, barba, 'pending'],
  ['Lucas Martins', 0, corte, 'pending'],
  ['Diego Fernandes', 1, corteBarba, 'confirmed'],
  ['Hugo Bezerra', 1, barba, 'confirmed'],
  ['Murilo Aguiar', 2, corte, 'pending'],
  ['Ulisses Rocha', 2, corteBarba, 'confirmed'],
  ['Jorge Anselmo', 3, corteBarba, 'confirmed'],
]
proximos.forEach(([nome, emDias, servico, status], i) => {
  const data = new Date()
  data.setUTCDate(data.getUTCDate() + emDias)
  const slot = reservar(i % profissionais.length, data, servico.duration_min)
  if (!slot) return
  agendamentos.push({
    tenant_id: tenantId,
    client_id: idPorNome[nome],
    professional_id: profissionais[slot.profIdx],
    service_id: servico.id,
    starts_at: slot.inicio.toISOString(),
    ends_at: slot.fim.toISOString(),
    status,
    origin: i % 2 === 0 ? 'public_page' : 'app',
    price_cents: servico.price_cents,
    confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
  })
})

for (let i = 0; i < agendamentos.length; i += 500) {
  const { error } = await svc.from('appointments').insert(agendamentos.slice(i, i + 500))
  precisa(error, `agendamentos lote ${i}`)
}

// ─────────────────────────────────────────────────────────────── mensagens prontas

const TEMPLATES = [
  ['confirmacao', 'Confirmar horário', 'Fala, {{nome}}! Confirmando seu horário na {{negocio}}: {{servico}} no dia {{data}} às {{hora}}. Tá de pé? 💈'],
  ['lembrete', 'Lembrete de amanhã', 'E aí, {{nome}}! Passando pra lembrar do seu horário amanhã, {{data}} às {{hora}}. Te espero aqui na {{negocio}}!'],
  ['sentimos_falta', 'Sumiu — chamar de volta', 'Opa {{nome}}, quanto tempo! Faz um tempinho que você não aparece na {{negocio}}. Bora dar um trato no visual? Me chama que eu encaixo seu horário. 💈'],
  ['aniversario', 'Feliz aniversário', 'Parabéns, {{nome}}! 🎉 A equipe da {{negocio}} te deseja tudo de bom. Passa aqui esse mês que o corte sai com um mimo por nossa conta.'],
  ['pos_atendimento', 'Depois do corte', 'Valeu pela visita, {{nome}}! Pra manter o corte bonito: lava com água morna e evita boné nas primeiras horas. Qualquer ajuste nos primeiros 7 dias é por nossa conta. 💈'],
  ['reagendar', 'Preciso remarcar', 'Oi {{nome}}, tudo certo? Preciso remarcar seu horário do dia {{data}}. Tenho vaga em outros horários — qual fica melhor pra você?'],
  ['promocao', 'Promoção da semana', 'Fala {{nome}}! Essa semana o {{servico}} tá saindo por {{valor}} aqui na {{negocio}}. Vagas limitadas — quer que eu já separe um horário?'],
  ['indicacao', 'Pedir indicação', '{{nome}}, valeu por ser cliente da casa! 🙏 Se indicar um amigo, os dois ganham desconto no próximo corte. É só ele falar seu nome aqui.'],
  ['falta', 'Cliente faltou', 'Oi {{nome}}, senti sua falta hoje no horário das {{hora}}. Aconteceu alguma coisa? Se quiser, já remarco pra outro dia — é só me falar.'],
  ['agradecimento', 'Agradecer cliente fiel', '{{nome}}, obrigado por confiar na {{negocio}} esse tempo todo! Cliente como você é o que segura essa casa de pé. 💈'],
]
precisa(
  (
    await svc.from('message_templates').insert(
      TEMPLATES.map(([slug, title, body], i) => ({ tenant_id: tenantId, slug, title, body, position: i })),
    )
  ).error,
  'templates',
)

// ─────────────────────────────────────────────────────────────── campanhas já rodadas

precisa(
  (
    await svc.from('campaigns').insert([
      {
        tenant_id: tenantId,
        name: 'Volta pra casa — clientes sumidos',
        segment: { tipo: 'atrasados', dias: 45 },
        template: 'sentimos_falta',
        status: 'done',
        sent_count: 18,
        booked_count: 7,
        revenue_cents: 47000,
      },
      {
        tenant_id: tenantId,
        name: 'Aniversariantes do mês',
        segment: { tipo: 'aniversariante' },
        template: 'aniversario',
        status: 'done',
        sent_count: 12,
        booked_count: 5,
        revenue_cents: 31500,
      },
      {
        tenant_id: tenantId,
        name: 'Promo terça — barba com 20%',
        segment: { tipo: 'tag', tag: 'barba' },
        template: 'promocao',
        status: 'done',
        sent_count: 6,
        booked_count: 4,
        revenue_cents: 14000,
      },
    ])
  ).error,
  'campanhas',
)

// ─────────────────────────────────────────────────────────────── números derivados

precisa(
  (await svc.rpc('recalcular_segmentos', { p_tenant: tenantId })).error && null, // pode não existir; o passo abaixo cobre
  'segmentos',
)

// `visits_count`/`ltv_cents`/`last_visit_at` são mantidos por job (cron diário). Sem cron no
// plano Hobby eles ficariam zerados e TODA a tela de CRM nasceria vazia — então recalculo aqui,
// com a mesma conta do `segmentos.ts`.
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

const { data: faltas } = await svc
  .from('appointments')
  .select('client_id')
  .eq('tenant_id', tenantId)
  .eq('status', 'no_show')
const porFalta = new Map()
for (const f of faltas ?? []) {
  if (!f.client_id) continue
  porFalta.set(f.client_id, (porFalta.get(f.client_id) ?? 0) + 1)
}

for (const [clientId, dados] of porCliente) {
  await svc
    .from('clients')
    .update({
      visits_count: dados.visitas,
      ltv_cents: dados.ltv,
      last_visit_at: dados.ultima,
      no_show_count: porFalta.get(clientId) ?? 0,
    })
    .eq('id', clientId)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      login: { email: EMAIL, senha: SENHA },
      site: `/${SLUG}`,
      tenantId,
      clientes: clientesCriados.length,
      agendamentos: agendamentos.length,
    },
    null,
    2,
  ),
)
