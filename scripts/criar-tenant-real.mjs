/**
 * Cria uma conta REAL (não demo) — usuário de verdade + tenant + assinatura promovida — pronta
 * pra logar. Diferente de `seed-tenant-teste.mjs`: não semeia agenda/clientes falsos (isso é o
 * dono que preenche usando o produto). Diferente de `promover-tenant.mjs`: o tenant ainda não
 * existe, então precisa nascer primeiro.
 *
 * Segue os MESMOS passos de `executarOnboarding` (`src/server/services/onboarding.ts`) à mão, em
 * vez de importar o módulo TypeScript direto — este repositório não tem `tsx`/`ts-node`
 * instalado, e os outros scripts `.mjs` já evitam depender de path alias por esse motivo (ver
 * comentário de `promover-tenant.mjs`).
 *
 * ## O que este script NÃO faz, de propósito
 *
 * Não cria a linha em `tenant_keys` (a DEK do cofre de dado de saúde/anamnese). Gerar essa chave
 * fora do processo do Next.js exigiria a MESMA `KEK` de produção que cifra ela — reimplementar
 * isso aqui com uma chave diferente criaria um cofre que o app de produção NUNCA conseguiria
 * abrir de volta, silenciosamente. Como `tenant_keys` só é lida pelo módulo de anamnese/cofre
 * (`src/server/crypto/vault.ts`) — agenda, comanda, clientes, Motor de Ciclo não tocam nela —
 * ficar sem essa linha é seguro para uma barbearia. Se o dono um dia precisar de anamnese, o
 * conserto é abrir `/admin/config` e salvar qualquer campo do módulo uma vez (o caminho normal já
 * cobre "tenant sem chave ainda").
 *
 * ## Uso
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<chave> \
 *     node scripts/criar-tenant-real.mjs "Barbearia do Alemão" barber "dono@exemplo.app" "+5549911776800" avancado
 *
 * A chave e a URL vêm de VARIÁVEL DE AMBIENTE, não de `.env.local` — de propósito: esse arquivo
 * aponta pro banco de DESENVOLVIMENTO local (127.0.0.1), e este script existe pra rodar contra
 * PRODUÇÃO. Ler `.env.local` aqui repetiria o incidente já registrado em `docs/DECISOES.md` de um
 * script de teste escrevendo sem querer no banco errado.
 *
 * Senha sai aleatória e imprime no terminal UMA vez — ninguém guarda senha de outra pessoa.
 */
import { randomBytes } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !CHAVE) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente (não em .env.local).')
  process.exit(1)
}
if (URL.includes('127.0.0.1') || URL.includes('localhost')) {
  console.error('SUPABASE_URL aponta pra localhost — este script é pra produção. Confira a variável.')
  process.exit(1)
}

const DEGRAUS = ['gratis', 'essencial', 'equipe', 'avancado']

const [, , NOME, VERTICAL, EMAIL, TELEFONE, DEGRAU] = process.argv
if (!NOME || !VERTICAL || !EMAIL) {
  console.error('Uso: node scripts/criar-tenant-real.mjs "<nome do negócio>" <vertical> "<email>" ["<telefone E.164>"] [degrau]')
  console.error(`Degraus: ${DEGRAUS.join(', ')} (padrão: gratis, se omitido)`)
  process.exit(1)
}
const degrau = DEGRAU ?? 'gratis'
if (!DEGRAUS.includes(degrau)) {
  console.error(`"${degrau}" não é um degrau. Use um de: ${DEGRAUS.join(', ')}`)
  process.exit(1)
}

function slugificar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

const svc = createClient(URL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })
const senha = randomBytes(9).toString('base64url')
const slugBase = slugificar(NOME)

function precisa(erro, onde) {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? erro)
    process.exitCode = 1
    return true
  }
  return false
}

async function main() {
  // Slug único: se já existir (segunda tentativa, nome parecido), acrescenta um sufixo curto em
  // vez de falhar — mesmo raciocínio de `onboarding.ts`, que já lida com colisão de slug.
  let slug = slugBase
  const { data: colisao } = await svc.from('tenants').select('id').eq('slug', slug).maybeSingle()
  if (colisao) slug = `${slugBase}-${randomBytes(2).toString('hex')}`

  const { data: userData, error: erroUser } = await svc.auth.admin.createUser({
    email: EMAIL,
    password: senha,
    email_confirm: true,
    user_metadata: { full_name: NOME, phone: TELEFONE || null },
  })
  if (precisa(erroUser, 'criar usuário')) return
  const userId = userData.user.id

  const { data: tenant, error: erroTenant } = await svc
    .from('tenants')
    .insert({ name: NOME, slug, vertical: VERTICAL, timezone: 'America/Sao_Paulo', phone: TELEFONE || null })
    .select('id, name, slug')
    .single()
  if (precisa(erroTenant, 'criar tenant')) {
    await svc.auth.admin.deleteUser(userId)
    return
  }

  if (
    precisa((await svc.from('memberships').insert({ tenant_id: tenant.id, user_id: userId, role: 'owner' })).error, 'criar vínculo de dono') ||
    precisa((await svc.rpc('apply_vertical_pack', { p_tenant: tenant.id, p_vertical: VERTICAL })).error, 'aplicar pack de serviços')
  ) {
    return
  }

  // O dono também é profissional que atende — sem isso ninguém aparece pra agendar com.
  // `apply_vertical_pack` já grava o expediente GERAL (`business_hours` com `professional_id`
  // nulo, seg-sáb); o POR-PROFISSIONAL não nasce sozinho — sem ele a página pública responde
  // "sem horário livre" todo santo dia, incidente já medido em 31/08 (ver seed-tenant-teste.mjs).
  const { data: dono, error: erroProf } = await svc
    .from('professionals')
    .insert({ tenant_id: tenant.id, user_id: userId, display_name: NOME, comp_model: 'owner', color: '#8b5cf6' })
    .select('id')
    .single()
  if (precisa(erroProf, 'criar profissional dono')) return
  const expediente = [1, 2, 3, 4, 5, 6].map((weekday) => ({
    tenant_id: tenant.id,
    professional_id: dono.id,
    weekday,
    opens_at: '09:00',
    closes_at: weekday === 6 ? '14:00' : '19:00',
  }))
  if (precisa((await svc.from('business_hours').insert(expediente)).error, 'expediente do profissional')) return

  // Evento do funil (G-05a), mesmo padrão de `registrarEvento` — pra esta conta aparecer nos
  // mesmos relatórios de ativação que uma conta que veio pelo formulário público geraria.
  await svc.from('product_events').insert({ tenant_id: tenant.id, event_type: 'conta_criada', meta: { origem: 'criar-tenant-real.mjs' } })

  if (degrau !== 'gratis') {
    const { error: erroPlano } = await svc.from('tenants').update({ plan: degrau }).eq('id', tenant.id)
    if (erroPlano) {
      console.error('conta criada, mas a promoção de plano falhou:', erroPlano.message)
    } else {
      await svc.from('audit_log').insert({
        tenant_id: tenant.id,
        action: 'tenant.plan.change',
        entity: 'tenants',
        entity_id: tenant.id,
        before: { plan: 'gratis' },
        after: { plan: degrau, motivo: 'testador fundador', por: 'scripts/criar-tenant-real.mjs' },
      })
    }
  }

  console.log(`\n${tenant.name} — pronta em https://seuciclo.com.br/${tenant.slug}`)
  console.log(`  e-mail:  ${EMAIL}`)
  console.log(`  senha:   ${senha}`)
  console.log(`  plano:   ${degrau}`)
  console.log(`\nManda essas duas linhas (e-mail + senha) pro dono e peça pra trocar a senha no primeiro login.\n`)
}

await main()
