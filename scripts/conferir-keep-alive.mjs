#!/usr/bin/env node
/**
 * "O keep-alive contra cold start (migration 0090) está rodando de verdade em produção?" — com
 * código de saída, mesmo espírito de `conferir-schema-prod.mjs`.
 *
 * A decisão de plataforma já foi tomada (12/09, migration 0090): não pagar Vercel Pro/Enterprise
 * por instância sempre-quente — em vez disso, `pg_cron` bate em `/api/health` a cada 5 minutos, de
 * dentro do próprio Postgres, sem custo. O que este script não sabe dizer sozinho é se esse job
 * está rodando de verdade em produção — isso só o painel do Supabase confirma (Database → Cron
 * Jobs → `ciclo_keep_alive`, e a tabela `cron.job_run_details`).
 *
 * O que ESTE script mede, só por HTTP e sem credencial nenhuma: a latência de `/api/health` agora.
 * Um contêiner frio custa bem mais que um quente (`docs/28` §7-9 mediu a diferença) — não é prova
 * definitiva (a primeira chamada deste próprio script pode SER o que aquece o contêiner), mas uma
 * segunda chamada poucos segundos depois, bem mais rápida que a primeira, é sinal forte de que
 * alguma coisa já mantém o contêiner quente.
 *
 * ## Como usar
 *
 *   node scripts/conferir-keep-alive.mjs
 *   node scripts/conferir-keep-alive.mjs https://preview-xyz.vercel.app
 *
 * ## O que este script NÃO confere, e por quê
 *
 * Se o job `ciclo_keep_alive` (0090) e o `cron_base_url` (Vault) existem no banco de produção —
 * isso exige `service_role` ou acesso ao painel do Supabase, que este script propositalmente não
 * pede (mesma regra do `conferir-schema-prod.mjs`: só leitura pública, sem segredo). O comentário
 * no fim da saída diz exatamente o que conferir manualmente e por quê.
 */

const BASE = (process.argv[2] || 'https://seuciclo.com.br').replace(/\/+$/, '')
const ALVO = `${BASE}/api/health`

const LIMIAR_FRIO_MS = 900 // `docs/28` mediu cold start em torno de 1s; folga pra não alarmar por ruído de rede comum

async function medir() {
  const inicio = performance.now()
  const resp = await fetch(ALVO, { headers: { accept: 'application/json' } })
  const ms = performance.now() - inicio
  await resp.json().catch(() => null)
  return { ms, status: resp.status }
}

async function conferir() {
  console.log(`Medindo ${ALVO} duas vezes, com 3s de intervalo...\n`)

  const primeira = await medir()
  console.log(`1ª chamada: ${Math.round(primeira.ms)}ms (HTTP ${primeira.status})`)

  await new Promise((r) => setTimeout(r, 3000))

  const segunda = await medir()
  console.log(`2ª chamada: ${Math.round(segunda.ms)}ms (HTTP ${segunda.status})\n`)

  if (primeira.status !== 200 || segunda.status !== 200) {
    console.error(`Resposta não-200 — confira se ${BASE} está no ar antes de julgar latência.`)
    return 2
  }

  if (primeira.ms > LIMIAR_FRIO_MS && segunda.ms < LIMIAR_FRIO_MS / 2) {
    console.log('A 1ª chamada pagou o preço de contêiner frio; a 2ª já veio quente — normal, e')
    console.log('não prova nada sobre o keep-alive (esta própria chamada pode ter sido o aquecimento).')
  } else if (primeira.ms < LIMIAR_FRIO_MS && segunda.ms < LIMIAR_FRIO_MS) {
    console.log('As duas chamadas vieram rápidas — sinal consistente com o contêiner já estar')
    console.log('quente ANTES deste script rodar. Bom sinal de que o keep-alive está ativo.')
  } else {
    console.log('Latência sem padrão claro — normal (rede, região). Não dá pra concluir só com HTTP.')
  }

  console.log(`
Isto só mede latência HTTP, não confirma o job em si. Pra ter certeza de verdade, no painel do
Supabase de produção:

  1. Database → Cron Jobs → confira se 'ciclo_keep_alive' aparece agendado ('*/5 * * * *').
  2. Se não aparecer: a migration 0090 pode não estar aplicada ainda —
     rode 'node scripts/conferir-schema-prod.mjs ${BASE}' pra confirmar.
  3. Se aparecer mas nunca disparou: falta o segredo 'cron_base_url' no Vault. No SQL Editor:
       select vault.create_secret('${BASE}', 'cron_base_url');
     (só precisa rodar uma vez; a 0087 do Motor de Ciclo já pode ter criado este mesmo segredo —
     confira 'select name from vault.decrypted_secrets' antes de criar de novo)
  4. Se aparecer E tiver disparado: SQL Editor → 'select * from cron.job_run_details
     where jobid = (select jobid from cron.job where jobname = 'ciclo_keep_alive')
     order by start_time desc limit 5;' — 'succeeded' nas últimas linhas é a prova real.
`)

  return 0
}

process.exitCode = await conferir().catch((erro) => {
  console.error(`Não consegui falar com ${ALVO}: ${erro instanceof Error ? erro.message : erro}`)
  return 2
})
