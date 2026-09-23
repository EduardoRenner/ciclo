#!/usr/bin/env node
/**
 * Placar de distribuição — `docs/82` §13, a versão que roda sem painel.
 *
 * O runbook `docs/runbooks/placar-de-distribuicao.md` tem o mesmo placar em SQL, para o SQL Editor
 * do Supabase. Este script existe porque nem sempre há painel à mão (nesta mesma sessão o MCP do
 * Supabase recusou `execute_sql`): com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do
 * ambiente certo, `node scripts/placar-distribuicao.mjs` imprime o funil por canal e quem trouxe
 * quem.
 *
 * SÓ LEITURA, pelo mesmo motivo de `metricas-ativacao.mjs`: medidor que altera o que mede não é
 * medidor. Confira para qual banco o `.env.local` aponta antes de ler o número como produção.
 *
 * `montarPlacar` é pura e exportada — o teste a exercita sem banco (`tests/unit/server/
 * placar-distribuicao.test.ts`). A mesma regra de exclusão do SQL do runbook mora em
 * `CONTA_QUE_NAO_E_NEGOCIO`: se uma mudar, a outra tem que mudar junto.
 */

/** Demonstração, revisão de loja, resíduo de teste. Contá-las é o placar mentir. */
export const CONTA_QUE_NAO_E_NEGOCIO = [/^demo-/, /^apple-review/, /^teste-/, /^origem-e2e/, /^(health|alertas-estoque|recuperar|clientes|risco|teste|pe)-[0-9a-f]{6,}$/]

const MARCOS = ['base_importada', 'motor_viu_valor', 'recuperacao_enviada', 'cliente_voltou']

/**
 * @param {{ id: string, slug: string, plan: string, deleted_at: string | null }[]} tenants
 * @param {{ tenant_id: string, event_type: string, meta: any }[]} eventos
 */
export function montarPlacar(tenants, eventos) {
  const reais = new Map(
    tenants.filter((t) => !t.deleted_at && !CONTA_QUE_NAO_E_NEGOCIO.some((r) => r.test(t.slug))).map((t) => [t.id, t]),
  )

  const marcosPorConta = new Map()
  const criacoes = []
  for (const e of eventos) {
    if (!reais.has(e.tenant_id)) continue
    if (e.event_type === 'conta_criada') criacoes.push(e)
    if (MARCOS.includes(e.event_type)) {
      if (!marcosPorConta.has(e.tenant_id)) marcosPorConta.set(e.tenant_id, new Set())
      marcosPorConta.get(e.tenant_id).add(e.event_type)
    }
  }

  const porCanal = new Map()
  const indicacoes = []
  for (const c of criacoes) {
    const canal = c.meta?.origem?.canal ?? 'sem origem'
    const ref = c.meta?.origem?.ref ?? null
    const conta = reais.get(c.tenant_id)
    const marcos = marcosPorConta.get(c.tenant_id) ?? new Set()
    const linha = porCanal.get(canal) ?? { canal, contas: 0, base_importada: 0, motor_viu_valor: 0, recuperacao_enviada: 0, cliente_voltou: 0, pagantes: 0 }
    linha.contas++
    for (const m of MARCOS) if (marcos.has(m)) linha[m]++
    if (conta.plan !== 'gratis') linha.pagantes++
    porCanal.set(canal, linha)
    if (ref) indicacoes.push({ canal, quem_trouxe: ref, conta_nova: conta.slug, plano: conta.plan })
  }

  return {
    funil: [...porCanal.values()].sort((a, b) => b.contas - a.contas),
    indicacoes,
    contasReais: reais.size,
    contasSemEvento: reais.size - criacoes.length,
  }
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { config } = await import('dotenv')
  config({ path: '.env.local', quiet: true })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) {
    console.error('Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.')
    process.exit(1)
  }
  const db = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })

  const [{ data: tenants, error: e1 }, { data: eventos, error: e2 }] = await Promise.all([
    db.from('tenants').select('id, slug, plan, deleted_at'),
    db.from('product_events').select('tenant_id, event_type, meta').in('event_type', ['conta_criada', ...MARCOS]),
  ])
  if (e1 || e2) {
    console.error('Falha ao ler:', (e1 ?? e2).message)
    process.exit(1)
  }

  const placar = montarPlacar(tenants ?? [], eventos ?? [])
  console.log(`Banco: ${new URL(url).host}`)
  console.log(`Contas reais: ${placar.contasReais} (sem evento de criação — anteriores à 0088 ou evento perdido: ${placar.contasSemEvento})\n`)
  if (placar.funil.length === 0) console.log('Nenhuma conta real com evento de criação ainda.')
  else console.table(placar.funil)
  if (placar.indicacoes.length) {
    console.log('\nQuem trouxe quem:')
    console.table(placar.indicacoes)
  }
  if (placar.contasReais < 10) console.log('\nMenos de 10 contas: leia linha a linha, não como tendência.')
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('placar-distribuicao.mjs')) {
  await main()
}
