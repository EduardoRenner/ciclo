/**
 * L-5 (`docs/31-LANCAMENTO-AUDITORIA-E-PLANO.md`) — **o escritor de `tenants.plan`.**
 *
 * ## Por que este arquivo existe
 *
 * A trava de plano inteira do CICLO — 11 rotas com `exigirModulo`, os limites de
 * `verificarLimite`, o `BloqueioPlano`, a tela `/admin/config/meu-plano`, a página `/precos` —
 * está de pé sobre `tenants.plan`. E até 2026-08-30 **nada no repositório escrevia essa coluna.**
 * Nem o produto, nem um script, nem a importação. A auditoria da PR #30 registrou isso como
 * achado C1, e a consequência é concreta e cara:
 *
 *   > se alguém pagar hoje, não há caminho para entregar o que foi vendido.
 *
 * É a quinta coluna desta base com o mesmo defeito — lida por todo mundo, escrita por ninguém —
 * depois de `fee_cents` (quadro "Taxa" sempre zerado), `media.consent_id` (portfólio que nunca
 * lista nada) e `clients.referred_by` (indicação desligada da tomada). A guarda
 * `tests/unit/server/plano-tem-escritor.test.ts` existe para que não vire a sexta vez.
 *
 * ## Por que um SCRIPT, e não uma tela
 *
 * Porque é o tamanho certo do problema hoje. O `docs/18` §P.2 é explícito ao mandar **não
 * construir billing** antes de ≥10 pagantes, e a recomendação principal daquele plano é lançar
 * "com um preço só, cobrado à mão (link de pagamento no WhatsApp + `update tenants.plan`)".
 * Este script É esse `update`, com as guardas que um `update` cru no SQL editor não tem:
 * valida o degrau contra o catálogo real, mostra antes/depois, e grava trilha de auditoria.
 *
 * Uma tela de super-admin exigiria um papel que não existe no RBAC e serviria zero pagantes.
 * Quando houver ≥10, o caminho é o webhook do PSP escrevendo aqui — não uma tela.
 *
 * ## Uso
 *
 *   node scripts/promover-tenant.mjs <slug> <degrau> "<motivo>"
 *   node scripts/promover-tenant.mjs --listar
 *
 *   node scripts/promover-tenant.mjs ruivo-barber essencial "pagou o 1o mes via Pix 30/08"
 *
 * Rebaixar usa o mesmo comando (regra 5.1: cair de degrau nunca apaga nem esconde dado — o que
 * trava é CRIAR mais, e disso quem cuida é `podeCriar`).
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !CHAVE) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
  process.exit(1)
}

/**
 * A lista vive em `src/core/billing/planos.ts` (`PlanoTier`), que é TypeScript com alias de path
 * e um `.mjs` solto não resolve. Duplicar quatro strings é mais barato que montar build só para
 * isto — e a duplicação é VIGIADA: `plano-tem-escritor.test.ts` lê este arquivo e compara com o
 * enum de verdade, então um degrau novo que não chegue aqui reprova o build.
 */
const DEGRAUS = ['gratis', 'essencial', 'equipe', 'avancado']

const db = createClient(URL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })

async function listar() {
  const { data, error } = await db
    .from('tenants')
    .select('slug, name, plan, created_at')
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw error

  console.log('\nslug'.padEnd(28) + 'degrau'.padEnd(12) + 'nome')
  console.log('-'.repeat(70))
  for (const t of data ?? []) {
    console.log(String(t.slug).padEnd(28) + String(t.plan).padEnd(12) + t.name)
  }
  console.log()
}

async function promover(slug, degrau, motivo) {
  const { data: antes, error: erroLeitura } = await db
    .from('tenants')
    .select('id, slug, name, plan')
    .eq('slug', slug)
    .is('deleted_at', null)
    .maybeSingle()
  if (erroLeitura) throw erroLeitura

  if (!antes) {
    console.error(`Não existe tenant ativo com o slug "${slug}". Rode com --listar para ver os que existem.`)
    process.exit(1)
  }

  if (antes.plan === degrau) {
    console.log(`"${antes.name}" já está em ${degrau}. Nada a fazer.`)
    return
  }

  const { data: depois, error } = await db
    .from('tenants')
    .update({ plan: degrau })
    .eq('id', antes.id)
    .select('id, slug, name, plan')
    .maybeSingle()
  if (error) throw error

  /*
   * `UPDATE` de zero linhas não levanta erro no supabase-js — devolve `data: null` com
   * `error: null`. Sem esta checagem, uma RLS ou um id que não bate viraria "deu certo" no
   * console enquanto nada mudou no banco. É a armadilha que já apareceu quatro vezes nesta base.
   */
  if (!depois) {
    console.error('O update não alcançou nenhuma linha — nada foi gravado. Confira o slug e a chave de serviço.')
    process.exit(1)
  }

  /*
   * Trilha de auditoria: mudar o degrau de um tenant é mexer no que ele PODE FAZER e no que ele
   * paga. `actor_id` fica nulo de propósito — quem roda isto é um humano no terminal, não uma
   * sessão; inventar um uuid seria pior que a ausência honesta. O motivo vai no `after` para a
   * linha responder sozinha "por que este salão virou Essencial em 30/08?".
   *
   * `entity_id` é `uuid` no banco (mesmo que os tipos gerados digam `string | null`) — passar o
   * slug aqui compilaria e explodiria só no Postgres.
   */
  const { error: erroTrilha } = await db.from('audit_log').insert({
    tenant_id: antes.id,
    action: 'tenant.plan.change',
    entity: 'tenants',
    entity_id: antes.id,
    before: { plan: antes.plan },
    after: { plan: depois.plan, motivo: motivo ?? null, por: 'scripts/promover-tenant.mjs' },
  })
  if (erroTrilha) {
    console.error('ATENÇÃO: o degrau mudou, mas a trilha de auditoria falhou:', erroTrilha.message)
    process.exit(1)
  }

  console.log(`\n${depois.name} (${depois.slug})`)
  console.log(`  ${antes.plan}  ->  ${depois.plan}`)
  if (motivo) console.log(`  motivo: ${motivo}`)
  console.log()
}

const [, , slug, degrau, motivo] = process.argv

if (slug === '--listar') {
  await listar()
} else if (!slug || !degrau) {
  console.error('Uso: node scripts/promover-tenant.mjs <slug> <degrau> "<motivo>"')
  console.error('     node scripts/promover-tenant.mjs --listar')
  console.error(`\nDegraus: ${DEGRAUS.join(', ')}`)
  process.exit(1)
} else if (!DEGRAUS.includes(degrau)) {
  console.error(`"${degrau}" não é um degrau. Use um de: ${DEGRAUS.join(', ')}`)
  process.exit(1)
} else {
  await promover(slug, degrau, motivo)
}
