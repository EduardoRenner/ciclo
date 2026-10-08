/**
 * docs/101 anexo 06 (T5b.1): o escritório-modelo do pacote Advocacia. Tudo FICTÍCIO: nenhuma
 * pessoa, empresa, processo ou órgão daqui existe, e o repositório é público.
 *
 *   SEED_SENHA='...' node scripts/seed-demo-escritorio.mjs
 *
 * Rodar de novo apaga e recria (o tenant cai por slug, o resto vai no cascade; os usuários caem por e-mail).
 *
 * **Gera por linha do tempo, não por taxa.** O script anda 18 meses de abertura de casos e 90 dias de
 * intimações sorteando o que acontece em cada dia (quando o cliente responde, quando a triagem
 * decide), e os números que a tela mostra saem do banco DEPOIS. Mesma lição do `seed-demo-6-negocios`
 * (memória `seed-volume-sai-do-historico`): proporção fixada à mão vira absurdo no agregado.
 *
 * Só roda contra o banco LOCAL: a URL tem que ser 127.0.0.1/localhost, ou o script para.
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

/** O ambiente do processo vence o arquivo: na CI não há `.env.local`, as variáveis vêm do job. */
const env = {
  ...(existsSync('.env.local')
    ? Object.fromEntries(
        readFileSync('.env.local', 'utf8')
          .split('\n')
          .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
          .map((l) => {
            const i = l.indexOf('=')
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
          }),
      )
    : {}),
  ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v)),
}

const URL_DO_BANCO = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(URL_DO_BANCO)) {
  console.error(`Recusado: este gerador só roda no banco local, e a URL é ${URL_DO_BANCO || '(vazia)'}.`)
  process.exit(1)
}

const SAL_TELEFONE = env.PHONE_HASH_SALT
if (!SAL_TELEFONE) throw new Error('PHONE_HASH_SALT ausente: sem ele o hash sairia diferente do que o app calcula.')
const hashTelefone = (e164) => createHash('sha256').update(e164 + SAL_TELEFONE, 'utf8').digest('hex')

const svc = createClient(URL_DO_BANCO, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anonimo = () => createClient(URL_DO_BANCO, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const SLUG = 'demo-alvorada-advocacia'
const NOME = 'Alvorada Advocacia (exemplo)'
const TZ = 'America/Sao_Paulo'
/** Regra 10 do CLAUDE.md: senha nenhuma no repositório. Sem `SEED_SENHA`, uma é sorteada e impressa. */
const SENHA = process.env.SEED_SENHA ?? `demo-${randomBytes(6).toString('base64url')}`
const OAB_DA_CASA = { numero: '12345', uf: 'SC' }

// ---------------------------------------------------------------------------------------------
// Sorteio reprodutível: a mesma semente dá o mesmo escritório (a demo não muda entre ensaios)
// ---------------------------------------------------------------------------------------------
let estado = 101
function aleatorio() {
  estado = (estado + 0x6d2b79f5) | 0
  let t = Math.imul(estado ^ (estado >>> 15), 1 | estado)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const sortear = (lista) => lista[Math.floor(aleatorio() * lista.length)]
const entre = (a, b) => a + Math.floor(aleatorio() * (b - a + 1))
const chance = (p) => aleatorio() < p
function normal() {
  const u = 1 - aleatorio()
  const v = aleatorio()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function poisson(media) {
  const l = Math.exp(-media)
  let k = 0
  let p = 1
  do {
    k++
    p *= aleatorio()
  } while (p > l)
  return k - 1
}
function ponderado(pares) {
  const total = pares.reduce((s, [, peso]) => s + peso, 0)
  let r = aleatorio() * total
  for (const [valor, peso] of pares) if ((r -= peso) <= 0) return valor
  return pares[pares.length - 1][0]
}

// ---------------------------------------------------------------------------------------------
// Datas (ISO, dia civil de São Paulo)
// ---------------------------------------------------------------------------------------------
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const somarDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const diaDaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay()
let FERIADOS = new Set()
const util = (iso) => diaDaSemana(iso) !== 0 && diaDaSemana(iso) !== 6 && !FERIADOS.has(iso)
function somarUteis(iso, n) {
  let d = iso
  let faltam = Math.abs(n)
  const passo = n >= 0 ? 1 : -1
  while (faltam > 0) {
    d = somarDias(d, passo)
    if (util(d)) faltam--
  }
  return d
}
const proximoUtil = (iso) => (util(iso) ? iso : somarUteis(iso, 1))
const instante = (iso, hora = 10) => new Date(`${iso}T${String(hora + 3).padStart(2, '0')}:00:00Z`).toISOString()

function precisa(r, onde) {
  if (r.error) {
    console.error(`falhou em ${onde}:`, r.error.message ?? r.error)
    process.exit(1)
  }
  return r.data
}

/** Insere em lotes: o PostgREST aceita lote grande, mas um erro num lote de 500 é ilegível. */
async function inserir(tabela, linhas, colunas = 'id') {
  const saida = []
  for (let i = 0; i < linhas.length; i += 100) {
    // `defaultToNull: false`: num lote com chaves diferentes, a coluna ausente pega o DEFAULT, e não null.
    const r = await svc.from(tabela).insert(linhas.slice(i, i + 100), { defaultToNull: false }).select(colunas)
    saida.push(...precisa(r, `${tabela} (lote ${i / 100 + 1})`))
  }
  return saida
}

// ---------------------------------------------------------------------------------------------
// TOTP (RFC 6238) para ativar o segundo fator da conta de demonstração
// ---------------------------------------------------------------------------------------------
function base32(s) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
export function codigoTotp(segredo, quando = Date.now()) {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(quando / 30_000)))
  const h = createHmac('sha1', base32(segredo)).update(contador).digest()
  const o = h[h.length - 1] & 0xf
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0')
}

// ---------------------------------------------------------------------------------------------
// O elenco (fictício)
// ---------------------------------------------------------------------------------------------
const EQUIPE = [
  { chave: 'direcao', nome: 'Helena Prado', email: 'direcao@alvorada-exemplo.ciclo.app', papel: 'owner', legal: 'advogado', oab: OAB_DA_CASA.numero },
  { chave: 'adv1', nome: 'Rafael Antunes', email: 'rafael@alvorada-exemplo.ciclo.app', papel: 'professional', legal: 'advogado', oab: '23456' },
  // OAB 00000 é inválida de propósito: a tela de configuração mostra o aviso "N sem OAB válida"
  { chave: 'adv2', nome: 'Camila Teixeira', email: 'camila@alvorada-exemplo.ciclo.app', papel: 'professional', legal: 'advogado', oab: '0' },
  { chave: 'estagio', nome: 'Davi Monteiro', email: 'davi@alvorada-exemplo.ciclo.app', papel: 'professional', legal: 'estagio', oab: null },
  { chave: 'secretaria', nome: 'Sônia Ribeiro', email: 'sonia@alvorada-exemplo.ciclo.app', papel: 'reception', legal: null, oab: null },
]

/** As quatro famílias com estrutura societária (anexo 06 §3, cenário 3). */
const FAMILIAS = [
  {
    titular: 'Antônio Moreira Alves',
    pessoas: [
      ['Marina Moreira Alves', 'conjuge'],
      ['Lucas Moreira Alves', 'filho_filha'],
      ['Beatriz Moreira Alves', 'filho_filha'],
    ],
    holding: 'MA Participações Ltda (exemplo)',
    operacional: 'Alves Transportes Ltda (exemplo)',
  },
  {
    titular: 'Rogério Bittencourt Lago',
    pessoas: [
      ['Clara Bittencourt Lago', 'conjuge'],
      ['Tiago Bittencourt Lago', 'filho_filha'],
    ],
    holding: 'BL Patrimonial Ltda (exemplo)',
    operacional: 'Lago Alimentos Ltda (exemplo)',
  },
  {
    titular: 'Vera Quintana Reis',
    pessoas: [
      ['Paulo Quintana Reis', 'conjuge'],
      ['Ana Quintana Reis', 'filho_filha'],
      ['Igor Quintana Reis', 'filho_filha'],
    ],
    holding: 'QR Holding Ltda (exemplo)',
    operacional: 'Reis Construções Ltda (exemplo)',
  },
  {
    titular: 'Jorge Sampaio Duarte',
    pessoas: [['Lúcia Sampaio Duarte', 'conjuge']],
    holding: 'SD Participações Ltda (exemplo)',
    operacional: 'Duarte Agro Ltda (exemplo)',
  },
]

const OUTROS_CLIENTES = [
  'Fernanda Castilho', 'Gustavo Pereira Lins', 'Renata Okamoto', 'Marcelo Fagundes', 'Patrícia Nogueira',
  'Eduarda Valente', 'Henrique Bastos', 'Juliana Freitas Rocha', 'Otávio Mendes', 'Larissa Campos',
  'Sérgio Vilela', 'Tânia Moura', 'Ricardo Albuquerque', 'Débora Santana', 'Felipe Coutinho',
  'Mônica Arruda', 'Leandro Siqueira', 'Cristina Paiva', 'Rodrigo Teles', 'Simone Barcellos',
  'Alberto Fontes', 'Viviane Caldas', 'Mateus Correia', 'Elaine Prates', 'Natália Brandão', 'Caio Rezende',
]

const TIPOS_DE_CASO = [
  ['holding', 12, 'holding_planejamento', 'Holding', 'o planejamento da família'],
  ['inventario', 10, 'familia_sucessoes', 'Inventário', 'o inventário'],
  ['planejamento_sucessorio', 8, 'holding_planejamento', 'Planejamento sucessório', 'o planejamento sucessório'],
  ['divorcio_partilha', 6, 'familia_sucessoes', 'Divórcio e partilha', 'a partilha'],
  ['contrato', 4, 'empresarial', 'Contrato', 'o contrato'],
  ['societario', 5, 'empresarial', 'Alteração societária', 'a alteração da empresa'],
  ['civel', 5, 'civel', 'Ação cível', 'o seu processo'],
  ['trabalhista', 3, 'trabalhista', 'Reclamação trabalhista', 'o seu processo'],
  ['tributario', 2, 'tributario', 'Execução fiscal', 'o seu processo'],
]
const JUDICIAIS = new Set(['civel', 'trabalhista', 'tributario'])

/** Tipos sem modelo da plataforma: poucas pendências avulsas, como o escritório faria à mão. */
const AVULSAS = {
  contrato: [['Minuta do contrato anterior', 'enviar_documento', 'cliente', 2], ['Revisar a minuta nova', 'conferir', 'equipe', 5]],
  civel: [['Procuração assinada', 'assinar', 'cliente', 1], ['Documentos pessoais', 'enviar_documento', 'cliente', 3], ['Comprovantes do pedido', 'enviar_documento', 'cliente', 7]],
  trabalhista: [['Procuração assinada', 'assinar', 'cliente', 1], ['Carteira de trabalho e holerites', 'enviar_documento', 'cliente', 5]],
  tributario: [['Procuração assinada', 'assinar', 'cliente', 1], ['Certidões da empresa', 'enviar_documento', 'cliente', 5]],
}

const TRIBUNAIS = [['TJSC', 78], ['TRT12', 10], ['TJSP', 7], ['TRF4', 5]]
const SEGMENTO = { TJSC: '824', TRT12: '512', TJSP: '826', TRF4: '404' }
const EXTENSO = { 5: 'cinco', 10: 'dez', 15: 'quinze', 30: 'trinta' }
const MODELOS_DE_TEXTO = [
  (n) => `Fica a parte intimada, por sua advocacia, para se manifestar ${n ? `no prazo de ${n} (${EXTENSO[n]}) dias ` : ''}sobre o documento juntado. Exemplo fictício.`,
  (n) => `Intimação da decisão proferida nos autos. ${n ? `Prazo de ${n} (${EXTENSO[n]}) dias para recurso. ` : ''}Exemplo fictício.`,
  (n) => `Ciência às partes do retorno dos autos${n ? `, com prazo de ${n} (${EXTENSO[n]}) dias para requerer o que entenderem de direito` : ''}. Exemplo fictício.`,
  () => 'Ato ordinatório: vista dos autos às partes. Exemplo fictício.',
]

/** Número de processo FICTÍCIO: origem 9999 não existe na tabela de órgãos do CNJ. */
function numeroFicticio(tribunal) {
  const seq = String(entre(1, 9_999_999)).padStart(7, '0')
  const dv = String(entre(10, 99))
  const ano = String(entre(2021, 2026))
  return `${seq}${dv}${ano}${SEGMENTO[tribunal]}9999`
}

// ---------------------------------------------------------------------------------------------
// Limpeza
// ---------------------------------------------------------------------------------------------
async function limpar() {
  const antigo = await svc.from('tenants').select('id').eq('slug', SLUG).maybeSingle()
  if (antigo.data) precisa(await svc.from('tenants').delete().eq('id', antigo.data.id), 'apagar tenant antigo')
  const lista = precisa(await svc.auth.admin.listUsers({ perPage: 1000 }), 'listar usuários')
  for (const u of lista.users.filter((x) => EQUIPE.some((m) => m.email === x.email))) await svc.auth.admin.deleteUser(u.id)
}

// ---------------------------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------------------------
async function main() {
  await limpar()
  FERIADOS = new Set(precisa(await svc.from('legal_holidays').select('day').is('tenant_id', null), 'feriados').map((f) => f.day))

  const profissao = precisa(await svc.from('professions').select('id').eq('slug', 'advocacia').single(), 'profissão advocacia')
  const tenant = precisa(
    await svc
      .from('tenants')
      .insert({ name: NOME, slug: SLUG, vertical: 'general', plan: 'avancado', timezone: TZ, profession_id: profissao.id })
      .select('id')
      .single(),
    'tenant',
  )
  const T = tenant.id

  // ── equipe
  const prof = {}
  const usuario = {}
  for (const m of EQUIPE) {
    const u = precisa(
      await svc.auth.admin.createUser({ email: m.email, password: SENHA, email_confirm: true, user_metadata: { full_name: m.nome } }),
      `usuário ${m.chave}`,
    )
    usuario[m.chave] = u.user.id
    precisa(await svc.from('memberships').insert({ tenant_id: T, user_id: u.user.id, role: m.papel }), `membership ${m.chave}`)
    const p = precisa(
      await svc
        .from('professionals')
        .insert({
          tenant_id: T,
          user_id: u.user.id,
          display_name: m.nome,
          comp_model: m.papel === 'owner' ? 'owner' : 'commission',
          legal_role: m.legal,
          oab_number: m.oab,
          oab_uf: m.oab ? 'SC' : null,
        })
        .select('id')
        .single(),
      `profissional ${m.chave}`,
    )
    prof[m.chave] = p.id
  }
  const ADVOCACIA = ['direcao', 'adv1', 'adv2']

  // ── clientes e pessoas
  let telefone = 1000
  const novoTelefone = () => `+55489990${String(telefone++).padStart(5, '0')}`
  const clientes = []
  for (const f of FAMILIAS) clientes.push({ nome: f.titular, familia: f })
  for (const nome of OUTROS_CLIENTES) clientes.push({ nome })
  const linhasClientes = clientes.map((c) => {
    const tel = novoTelefone()
    c.telefone = tel
    return { tenant_id: T, name: c.nome, phone_e164: tel, phone_hash: hashTelefone(tel) }
  })
  const idsClientes = await inserir('clients', linhasClientes)
  clientes.forEach((c, i) => (c.id = idsClientes[i].id))

  const pessoas = []
  for (const c of clientes) {
    pessoas.push({ tenant_id: T, client_id: c.id, full_name: c.nome, relationship: 'titular', phone_e164: c.telefone, is_contact: true })
    for (const [nome, rel] of c.familia?.pessoas ?? []) pessoas.push({ tenant_id: T, client_id: c.id, full_name: nome, relationship: rel })
    if (!c.familia && chance(0.4)) pessoas.push({ tenant_id: T, client_id: c.id, full_name: `${sortear(['Rita', 'Márcio', 'Joana', 'Bruno'])} ${c.nome.split(' ').slice(-1)[0]}`, relationship: 'conjuge' })
  }
  const idsPessoas = await inserir('legal_persons', pessoas, 'id, client_id, full_name')
  const pessoaPorNome = new Map(idsPessoas.map((p) => [p.full_name, p.id]))

  // ── estrutura das famílias: holding → operacional, atos ao longo do tempo
  let somaPlantada = null
  for (const [i, f] of FAMILIAS.entries()) {
    const cliente = clientes[i]
    const [holding, operacional] = await inserir('legal_entities', [
      { tenant_id: T, client_id: cliente.id, kind: 'holding_patrimonial', legal_name: f.holding, legal_form: 'ltda', uf: 'SC', incorporated_on: somarDias(HOJE, -entre(500, 900)) },
      { tenant_id: T, client_id: cliente.id, kind: 'operacional', legal_name: f.operacional, legal_form: 'ltda', uf: 'SC', incorporated_on: somarDias(HOJE, -entre(2000, 5000)) },
    ])
    const constituiu = somarDias(HOJE, -entre(400, 480))
    const [atoH, atoO] = await inserir('legal_corporate_changes', [
      { tenant_id: T, entity_id: holding.id, effective_on: constituiu, kind: 'constituicao', description: 'Constituição da holding (exemplo).' },
      { tenant_id: T, entity_id: operacional.id, effective_on: somarDias(constituiu, 30), kind: 'cessao_quotas', description: 'Quotas integralizadas na holding (exemplo).' },
    ])
    const conjuge = f.pessoas.find(([, r]) => r === 'conjuge')?.[0]
    const titularId = pessoaPorNome.get(f.titular)
    const conjugeId = pessoaPorNome.get(conjuge)
    const participacoes = [
      { tenant_id: T, owned_entity_id: holding.id, owner_person_id: titularId, percent: 60, valid_from: constituiu, opened_by_change_id: atoH.id },
      { tenant_id: T, owned_entity_id: holding.id, owner_person_id: conjugeId, percent: 40, valid_from: constituiu, opened_by_change_id: atoH.id },
    ]
    if (i === 1) {
      // A inconsistência plantada (cenário 3): a cessão para a holding foi lançada, mas o ato que
      // tirava as quotas dos sócios pessoas físicas ficou "esquecido". A soma da operacional dá 110%.
      participacoes.push(
        { tenant_id: T, owned_entity_id: operacional.id, owner_entity_id: holding.id, percent: 30, valid_from: somarDias(constituiu, 30), opened_by_change_id: atoO.id },
        { tenant_id: T, owned_entity_id: operacional.id, owner_person_id: titularId, percent: 50, valid_from: somarDias(constituiu, -900), opened_by_change_id: atoO.id },
        { tenant_id: T, owned_entity_id: operacional.id, owner_person_id: conjugeId, percent: 30, valid_from: somarDias(constituiu, -900), opened_by_change_id: atoO.id },
      )
      somaPlantada = f.operacional
    } else {
      participacoes.push({ tenant_id: T, owned_entity_id: operacional.id, owner_entity_id: holding.id, percent: 100, valid_from: somarDias(constituiu, 30), opened_by_change_id: atoO.id })
    }
    if (i === 0) {
      // Doação com reserva de usufruto (Antônio doa 10% da holding aos filhos, guarda o usufruto).
      const doacao = (await inserir('legal_corporate_changes', [{ tenant_id: T, entity_id: holding.id, effective_on: somarDias(HOJE, -120), kind: 'doacao_quotas', description: 'Doação de quotas com reserva de usufruto (exemplo).' }]))[0]
      participacoes[0].valid_to = somarDias(HOJE, -120)
      participacoes[0].closed_by_change_id = doacao.id
      participacoes.push(
        { tenant_id: T, owned_entity_id: holding.id, owner_person_id: titularId, percent: 50, valid_from: somarDias(HOJE, -120), opened_by_change_id: doacao.id },
        { tenant_id: T, owned_entity_id: holding.id, owner_person_id: pessoaPorNome.get('Lucas Moreira Alves'), percent: 5, valid_from: somarDias(HOJE, -120), opened_by_change_id: doacao.id, usufruct_person_id: titularId },
        { tenant_id: T, owned_entity_id: holding.id, owner_person_id: pessoaPorNome.get('Beatriz Moreira Alves'), percent: 5, valid_from: somarDias(HOJE, -120), opened_by_change_id: doacao.id, usufruct_person_id: titularId },
      )
    }
    await inserir('legal_ownerships', participacoes)
  }

  // ── modelos de checklist da plataforma
  const modelos = precisa(
    await svc.from('legal_checklist_templates').select('id, case_kind, legal_checklist_template_items(position, title, kind, owed_by, offset_business_days, urgency, expected_category)').is('tenant_id', null),
    'modelos',
  )
  const modeloDo = new Map(modelos.map((m) => [m.case_kind, m]))

  // ── casos e pendências, abertos ao longo de 18 meses
  const fila = []
  for (const [kind, quantos] of TIPOS_DE_CASO.map(([k, n]) => [k, n])) for (let n = 0; n < quantos; n++) fila.push(kind)
  fila.sort(() => aleatorio() - 0.5)
  const casos = []
  const tipos = new Set()
  for (const [n, kind] of fila.entries()) {
    const [, , area, rotulo, paraCliente] = TIPOS_DE_CASO.find(([k]) => k === kind)
    // Famílias concentram holding e planejamento; o resto se espalha. Um cliente não tem dois casos
    // do MESMO tipo abertos (duas "Holding Alves" na fila denunciam o sorteio na hora da demo).
    const familiar = ['holding', 'planejamento_sucessorio', 'societario'].includes(kind) && chance(0.6)
    // divórcio nunca cai numa família da demo: a holding é do casal e a história ficaria incoerente
    const elegiveis = kind === 'divorcio_partilha' ? clientes.slice(FAMILIAS.length) : clientes
    const candidatos = (familiar ? clientes.slice(0, FAMILIAS.length) : elegiveis).filter((x) => !tipos.has(`${x.nome}:${kind}`))
    const cliente = sortear(candidatos.length > 0 ? candidatos : elegiveis.filter((x) => !tipos.has(`${x.nome}:${kind}`)))
    tipos.add(`${cliente.nome}:${kind}`)
    const abertoEm = proximoUtil(somarDias(HOJE, -Math.floor(Math.pow(aleatorio(), 1.6) * 540)))
    const sigiloso = n === 3 || n === 17
    const judicial = JUDICIAIS.has(kind)
    const tribunal = kind === 'trabalhista' ? 'TRT12' : kind === 'tributario' ? 'TRF4' : 'TJSC'
    casos.push({
      kind,
      cliente,
      abertoEm,
      judicial,
      tribunal,
      responsavel: sortear(ADVOCACIA),
      linha: {
        tenant_id: T,
        client_id: cliente.id,
        kind,
        area: sigiloso && kind === 'civel' ? 'criminal' : area,
        title: `${rotulo} ${cliente.nome.split(' ').slice(-1)[0]}${judicial ? '' : ''}`,
        client_title: paraCliente,
        status: 'em_andamento',
        sensitivity: sigiloso || (kind === 'civel' && n === 17) ? 'sigiloso' : 'normal',
        sensitivity_reason: sigiloso ? 'Pedido expresso do cliente (exemplo).' : null,
        responsible_professional_id: null,
        cnj_number: judicial ? numeroFicticio(tribunal) : null,
        rito: judicial ? (kind === 'trabalhista' ? 'trabalhista' : 'civel') : null,
        comarca: judicial ? sortear(['Florianópolis', 'São José', 'Palhoça', 'Joinville']) : null,
        opened_on: abertoEm,
        created_by: usuario.direcao,
      },
    })
  }
  for (const c of casos) c.linha.responsible_professional_id = prof[c.responsavel]

  const itensPorCaso = []
  for (const c of casos) {
    const passos = modeloDo.has(c.kind)
      ? modeloDo.get(c.kind).legal_checklist_template_items.sort((a, b) => a.position - b.position).map((p) => [p.title, p.kind, p.owed_by, p.offset_business_days, p.urgency, p.expected_category])
      : (AVULSAS[c.kind] ?? []).map(([t, k, o, d]) => [t, k, o, d, 'media', null])
    const itens = passos.map(([titulo, tipo, quem, offset, urgencia, categoria], i) => {
      const venceEm = somarUteis(c.abertoEm, offset)
      // A resposta do cliente: mediana de 9 dias, cauda longa, 15% nunca respondem no período.
      const nunca = quem === 'cliente' && chance(0.15)
      const demora = quem === 'cliente' ? Math.max(1, Math.round(Math.exp(Math.log(9) + 0.8 * normal()))) : offset + entre(0, 3)
      const chegou = nunca ? null : somarDias(c.abertoEm, demora)
      let status = 'pendente'
      let rodada = 1
      let rodadaDesde = c.abertoEm
      let devolucao = null
      let cancelamento = null
      const idadeDoCaso = Math.round((Date.parse(HOJE) - Date.parse(c.abertoEm)) / 86_400_000)
      if (!chegou && idadeDoCaso > 75) {
        // Ninguém deixa uma cobrança aberta por meses: depois de ~2 meses sem resposta o escritório
        // encerra a etapa. Sem isto, os 15% que nunca respondem se acumulam por 18 meses e a fila
        // mostra pendência de 240 dias, o que nenhum escritório de verdade tem.
        status = 'cancelado'
        cancelamento = sortear(['Cliente desistiu desta etapa (exemplo).', 'Substituído por outro documento (exemplo).', 'Etapa dispensada na reunião (exemplo).'])
      } else if (chegou && chegou <= HOJE) {
        const idade = Math.round((Date.parse(HOJE) - Date.parse(chegou)) / 86_400_000)
        // devolução só faz sentido se o documento chegou há pouco: a de meses atrás já foi resolvida
        if (quem === 'cliente' && idade <= 25 && chance(0.15)) {
          status = 'devolvido'
          rodada = 2
          rodadaDesde = somarDias(chegou, 2) > HOJE ? HOJE : somarDias(chegou, 2)
          devolucao = sortear(['Veio sem a última alteração contratual.', 'Cópia ilegível, precisa de nova digitalização.', 'Documento vencido; a certidão vale 30 dias.'])
        } else if (idade <= 3 && quem === 'cliente') status = chance(0.5) ? 'recebido' : 'em_conferencia'
        else status = 'concluido'
      }
      return {
        tenant_id: T,
        position: i + 1,
        title: titulo,
        kind: tipo,
        owed_by: quem,
        urgency: urgencia,
        expected_category: categoria,
        due_on: venceEm,
        status,
        rodada,
        rodada_desde: rodadaDesde,
        returned_reason: devolucao,
        cancel_reason: cancelamento,
        created_by: usuario.direcao,
      }
    })
    itensPorCaso.push(itens)
  }

  // Estado do caso sai das pendências: tudo concluído e antigo → concluído; algo com o cliente → aguardando.
  casos.forEach((c, i) => {
    const itens = itensPorCaso[i]
    const tudoFeito = itens.length > 0 && itens.every((x) => ['concluido', 'cancelado'].includes(x.status))
    if (tudoFeito && !c.judicial) {
      c.linha.status = 'concluido'
      c.linha.closed_on = HOJE < somarDias(c.abertoEm, 60) ? HOJE : somarDias(c.abertoEm, 60)
    } else if (itens.some((x) => x.owed_by === 'cliente' && ['pendente', 'devolvido'].includes(x.status))) c.linha.status = 'aguardando_cliente'
  })

  const idsCasos = await inserir('legal_cases', casos.map((c) => c.linha))
  casos.forEach((c, i) => (c.id = idsCasos[i].id))
  const membros = []
  for (const c of casos) {
    membros.push({ tenant_id: T, case_id: c.id, professional_id: prof[c.responsavel], role: 'responsavel' })
    if (c.linha.sensitivity === 'sigiloso' && c.responsavel !== 'direcao') membros.push({ tenant_id: T, case_id: c.id, professional_id: prof.direcao })
  }
  await inserir('legal_case_members', membros, 'case_id')
  const todosItens = casos.flatMap((c, i) => itensPorCaso[i].map((x) => ({ ...x, case_id: c.id })))
  await inserir('legal_checklist_items', todosItens)

  // Cenário 2: a família 1 tem a matrícula do imóvel atrasada 12 dias, e ela trava a holding.
  const holdingFamilia1 = casos.find((c) => c.kind === 'holding' && c.cliente === clientes[0])
  if (holdingFamilia1) {
    await inserir('legal_checklist_items', [
      { tenant_id: T, case_id: holdingFamilia1.id, position: 20, title: 'Matrícula atualizada do imóvel', kind: 'enviar_documento', owed_by: 'cliente', urgency: 'alta', expected_category: 'imovel', due_on: somarUteis(HOJE, -9), status: 'pendente', rodada_desde: somarDias(HOJE, -12), created_by: usuario.direcao },
    ])
  }

  // ── intimações dos últimos 90 dias, por dia útil
  const judiciais = casos.filter((c) => c.judicial)
  const intimacoes = []
  const sugestoes = []
  const prazos = []
  let djen = 4_000_000_000 + entre(0, 1_000_000)
  const diaDoPico = somarUteis(HOJE, -entre(25, 45))
  const ontem = somarUteis(HOJE, -1)
  for (let d = somarDias(HOJE, -90); d < HOJE; d = somarDias(d, 1)) {
    if (!util(d)) continue
    const quantas = d === diaDoPico ? 15 : d === ontem ? Math.max(2, poisson(1.3)) : poisson(1.3)
    for (let k = 0; k < quantas; k++) {
      // A primeira de ontem é o cenário 1 da demo, e não fica ao sabor do sorteio: intimação de verdade,
      // de um caso do escritório, com prazo em dias no texto.
      const cenario1 = d === ontem && k === 0
      const tribunal = ponderado(TRIBUNAIS)
      const doEscritorio = (chance(0.7) || cenario1) && judiciais.length > 0
      const caso = doEscritorio ? sortear(judiciais) : null
      const prazoDias = chance(0.26) || cenario1 ? sortear([5, 15, 15, 10, 30]) : null
      const tipo = cenario1 ? 'Intimação' : ponderado([['Intimação', 88], ['Lista de distribuição', 7], ['Ata', 5]])
      const texto = (tipo === 'Intimação' ? (cenario1 ? MODELOS_DE_TEXTO[0] : sortear(MODELOS_DE_TEXTO)) : MODELOS_DE_TEXTO[3])(tipo === 'Intimação' ? prazoDias : null)
      const temPrazo = tipo === 'Intimação' && prazoDias !== null
      const publicacao = somarUteis(d, 1)
      const fatal = temPrazo ? somarUteis(publicacao, prazoDias) : null
      const interno = fatal ? somarUteis(fatal, -2) : null
      // mesmo formato que `sugerirPrazo` grava (core/advocacia/prazo-sugestao.ts): a triagem lê as mesmas chaves
      const memo = temPrazo
        ? {
            texto: `${prazoDias} dias úteis contados do primeiro dia útil após a publicação.`,
            trecho: `prazo de ${prazoDias} (${EXTENSO[prazoDias]}) dias`,
            disponibilizado_em: d,
            publicado_em: publicacao,
            inicio_em: somarUteis(publicacao, 1),
            vence_em: fatal,
            dias_lidos: prazoDias,
            dias_contados: prazoDias,
            unidade: 'uteis',
            rito: 'civel',
            em_dobro: false,
            regras_confirmadas: ['unidade-civel'],
            prorrogado_de: null,
            pulados: [...FERIADOS].filter((f) => f > publicacao && f <= fatal && diaDaSemana(f) !== 0 && diaDaSemana(f) !== 6).sort().map((f) => `${f} feriado`),
          }
        : null

      // Triagem: 75% no mesmo dia útil, 20% no seguinte, 5% atrasam. Só as da última semana ficam SEM
      // triagem ("Exige direção"); as antigas atrasadas foram triadas dias depois. Sem isto, a fila de Hoje
      // mostrava intimação parada há 65 dias, o que nenhum escritório que usa o sistema teria.
      const sorteio = aleatorio()
      const recente = d >= somarUteis(HOJE, -5)
      const triadaEm = d === ontem ? null : sorteio < 0.75 ? d : sorteio < 0.95 ? somarUteis(d, 1) : recente ? null : somarUteis(d, entre(2, 4))
      const triada = triadaEm !== null && triadaEm < HOJE
      let status = 'nova'
      if (triada) status = caso ? (temPrazo ? 'prazo_criado' : chance(0.5) ? 'vinculada' : 'sem_prazo') : chance(0.6) ? 'descartada' : 'sem_prazo'
      // a de ontem com prazo já aparece vinculada ao caso (cenário 1), esperando a confirmação
      const vinculo = caso && (triada || cenario1) ? caso.id : null
      if (cenario1 && caso) status = 'vinculada'

      intimacoes.push({
        tenant_id: T,
        djen_id: djen++,
        numero_processo: caso ? caso.linha.cnj_number : numeroFicticio(tribunal),
        data_disponibilizacao: d,
        tribunal: caso ? caso.tribunal : tribunal,
        orgao: `${entre(1, 6)}ª Vara (exemplo)`,
        tipo,
        texto_sanitizado: texto,
        destinatarios: [],
        alvo: `OAB ${OAB_DA_CASA.numero}/${OAB_DA_CASA.uf}`,
        case_id: vinculo,
        status,
        triaged_by: status === 'nova' || status === 'vinculada' && !triada ? null : usuario[sortear(ADVOCACIA)],
        triaged_at: status === 'nova' || status === 'vinculada' && !triada ? null : instante(triadaEm ?? d, 16),
        reason: status === 'descartada' ? 'Processo de outro escritório com OAB homônima (exemplo).' : status === 'sem_prazo' ? 'Mera ciência (exemplo).' : null,
        _memo: memo,
        _fatal: fatal,
        _interno: interno,
        _caso: caso,
        _prazoDias: prazoDias,
      })
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- os campos com _ são do gerador, não do banco
  const linhasIntimacoes = intimacoes.map(({ _memo, _fatal, _interno, _caso, _prazoDias, ...l }) => l)
  // vinculada sem `triaged_*` é a de ontem: ligada ao caso, com o prazo ainda por decidir (0109 permite)
  const idsIntimacoes = await inserir('legal_intimations', linhasIntimacoes)
  intimacoes.forEach((x, i) => (x.id = idsIntimacoes[i].id))

  for (const x of intimacoes) {
    if (x._memo && (x.status === 'nova' || x.status === 'prazo_criado' || x.status === 'vinculada')) {
      sugestoes.push({ tenant_id: T, intimation_id: x.id, suggested_due_on: x._fatal, internal_due_on: x._interno, calc_memo: x._memo, calc_rule_version: 'prazo-regras-v1' })
    } else if (x.status === 'nova') {
      sugestoes.push({ tenant_id: T, intimation_id: x.id, sem_sugestao: 'O texto não traz prazo em dias. Leia e informe.' })
    }
    if (x.status === 'prazo_criado' && x._caso) {
      const divergiu = chance(0.1)
      const dueOn = divergiu ? somarUteis(x._fatal, -1) : x._fatal
      const vencido = dueOn < HOJE
      prazos.push({
        tenant_id: T,
        client_id: x._caso.cliente.id,
        case_id: x._caso.id,
        kind: 'fatal',
        title: `Manifestação (${x._prazoDias} dias)`,
        due_on: dueOn,
        internal_due_on: somarUteis(dueOn, -2) < dueOn ? somarUteis(dueOn, -2) : dueOn,
        source: 'djen',
        intimation_id: x.id,
        calc_memo: x._memo,
        calc_rule_version: 'prazo-regras-v1',
        suggested_due_on: x._fatal,
        calc_divergence: divergiu,
        responsible_professional_id: prof[x._caso.responsavel],
        confirmed_by: usuario.direcao,
        confirmed_at: instante(x.data_disponibilizacao, 17),
        status: vencido ? 'cumprido' : 'aberto',
        close_note: vencido ? 'Petição protocolada (exemplo).' : null,
        closed_at: vencido ? instante(somarUteis(dueOn, -1), 15) : null,
        closed_by: vencido ? usuario[x._caso.responsavel] : null,
        created_by: usuario.direcao,
      })
    }
  }
  await inserir('legal_intimation_suggestions', sugestoes)

  // Prazos sem intimação: audiências e contratuais, para a fila de Hoje não viver só de DJEN.
  for (const c of casos.filter((x) => x.judicial).slice(0, 6)) {
    const dia = proximoUtil(somarDias(HOJE, entre(2, 40)))
    prazos.push({ tenant_id: T, client_id: c.cliente.id, case_id: c.id, kind: 'audiencia', title: 'Audiência de conciliação', due_on: dia, due_at: instante(dia, entre(9, 16)), source: 'manual', responsible_professional_id: prof[c.responsavel], confirmed_by: usuario.direcao, confirmed_at: instante(HOJE, 9), created_by: usuario.direcao })
  }
  // prazo aberto só em caso aberto: caso concluído com "Registro na Junta" pendente denunciava o gerador
  for (const c of casos.filter((x) => (x.kind === 'societario' || x.kind === 'contrato') && x.linha.status !== 'concluido').slice(0, 5)) {
    const dia = proximoUtil(somarDias(HOJE, entre(-3, 30)))
    prazos.push({ tenant_id: T, client_id: c.cliente.id, case_id: c.id, kind: 'contratual', title: 'Registro na Junta Comercial', due_on: dia, internal_due_on: somarUteis(dia, -3), source: 'manual', responsible_professional_id: prof[c.responsavel], created_by: usuario.direcao })
  }
  await inserir('legal_deadlines', prazos)

  // Captura: um registro por dia útil, como o robô gravaria.
  const sync = []
  for (let d = somarDias(HOJE, -90); d < HOJE; d = somarDias(d, 1)) {
    if (!util(d)) continue
    const n = intimacoes.filter((x) => x.data_disponibilizacao === d).length
    sync.push({ tenant_id: T, alvo: `OAB ${OAB_DA_CASA.numero}/${OAB_DA_CASA.uf}`, dia: d, count_fonte: n, count_gravado: n, ok: true })
  }
  await inserir('legal_intimation_sync', sync)

  // ── segundo fator da direção (o pacote exige aal2): o segredo é impresso, nunca gravado no repositório.
  // Sem TOTP ligado no Auth (config.toml antigo, antes de reiniciar o Supabase), o resto do escritório
  // já está pronto: o aviso diz o que falta em vez de derrubar a semeadura inteira.
  let segredo = null
  const cliente = anonimo()
  precisa(await cliente.auth.signInWithPassword({ email: EQUIPE[0].email, password: SENHA }), 'login da direção')
  const fator = await cliente.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'demonstração' })
  if (fator.error) {
    console.warn(`
AVISO: o segundo fator não foi ativado (${fator.error.message}). Ligue [auth.mfa.totp] no config.toml e reinicie o Supabase.`)
  } else {
    const desafio = precisa(await cliente.auth.mfa.challenge({ factorId: fator.data.id }), 'desafio TOTP')
    precisa(await cliente.auth.mfa.verify({ factorId: fator.data.id, challengeId: desafio.id, code: codigoTotp(fator.data.totp.secret) }), 'confirmar TOTP')
    segredo = fator.data.totp.secret
  }

  // ── o agregado, lido do banco (é ele que a demo pode citar)
  const conta = async (tabela, filtro = (q) => q) => (await filtro(svc.from(tabela).select('*', { count: 'exact', head: true }).eq('tenant_id', T))).count
  console.log(`\n${NOME} semeado em ${HOJE}.`)
  console.log(`  clientes ${await conta('clients')} · pessoas ${await conta('legal_persons')} · empresas ${await conta('legal_entities')}`)
  console.log(`  casos ${await conta('legal_cases')} (sigilosos ${await conta('legal_cases', (q) => q.eq('sensitivity', 'sigiloso'))})`)
  console.log(`  pendências abertas ${await conta('legal_checklist_items', (q) => q.in('status', ['pendente', 'devolvido', 'recebido', 'em_conferencia']))} de ${await conta('legal_checklist_items')}`)
  console.log(`  intimações ${await conta('legal_intimations')} (novas ${await conta('legal_intimations', (q) => q.eq('status', 'nova'))}) · prazos ${await conta('legal_deadlines')}`)
  console.log(`  soma plantada em 110%: ${somaPlantada}`)
  console.log(`\nEntrar: ${EQUIPE[0].email}`)
  if (!process.env.SEED_SENHA) console.log(`Senha sorteada: ${SENHA}`)
  if (segredo) console.log(`Segredo do segundo fator (adicione no app autenticador): ${segredo}`)
}

await main()
