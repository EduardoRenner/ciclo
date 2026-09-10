#!/usr/bin/env node
/**
 * "A produção está atrás do código?" — em uma pergunta, com código de saída.
 *
 * O incidente de 2026-09-04 (`docs/62`): o `main` mergeou código que dependia de colunas da `0059`
 * a `0061`; a produção estava na `0058`; nada ficou vermelho porque a CI só aplica migration em
 * banco efêmero e a aplicação em produção é manual. `src/core/schema/versao.ts` já compara o livro
 * de migrations com o que o código espera, e `/api/health` já expõe isso em `checks.schema`. O que
 * faltava era um gate FORA do runtime — algo que o Eduardo rode antes de um deploy sensível, ou
 * pendure num Action quando tiver um.
 *
 * O `docs/57` PR 3.2 pediu exatamente isto. Não virou passo de `.github/workflows/` porque o
 * classificador do agente não escreve lá; virou este script.
 *
 * ## Como usar
 *
 *   node scripts/conferir-schema-prod.mjs
 *   node scripts/conferir-schema-prod.mjs https://preview-xyz.vercel.app
 *
 * Sai `0` se `checks.schema.ok === true`, `1` caso contrário (com o `detail` da própria rota),
 * `2` se não conseguiu falar com a rota. NÃO substitui o `supabase db push` — só torna o silêncio
 * barulhento.
 *
 * ## SÓ LEITURA
 *
 * Um `GET` em `/api/health`. Nenhuma credencial, nenhuma escrita.
 */

const BASE = (process.argv[2] || 'https://seuciclo.com.br').replace(/\/+$/, '')
const ALVO = `${BASE}/api/health`

async function conferir() {
  const resp = await fetch(ALVO, { headers: { accept: 'application/json' } })
  const corpo = await resp.json()
  const schema = corpo?.checks?.schema

  if (!schema || typeof schema.ok !== 'boolean') {
    console.error(`Resposta de ${ALVO} não tem checks.schema — a rota mudou de forma?`)
    return 2
  }

  if (schema.ok) {
    console.log(`schema OK — ${ALVO} diz que o banco está alinhado com o código.`)
    return 0
  }

  console.error(`BANCO ATRÁS DO CÓDIGO em ${BASE}:`)
  console.error(`  ${schema.detail || 'sem detalhe'}`)
  console.error('Aplicar as migrations pendentes com `supabase db push` antes de seguir.')
  return 1
}

// `process.exitCode` em vez de `process.exit()`: sair no meio de um `await fetch` corre com o
// fechamento dos sockets do undici e o Node no Windows aborta com um assert de libuv.
process.exitCode = await conferir().catch((erro) => {
  console.error(`Não consegui falar com ${ALVO}: ${erro instanceof Error ? erro.message : erro}`)
  return 2
})
