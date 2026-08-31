#!/usr/bin/env node
/**
 * `pnpm db:reset` com a trava que o FAQ ja prometia — e que nao existia.
 *
 * `docs/05-FAQ-DEV.md` B23 responde "Posso rodar `supabase db reset` em producao?" com:
 * *"Nunca. O comando e bloqueado por guard no `package.json` quando `NODE_ENV=production`."*
 * O `package.json` tinha apenas `"db:reset": "supabase db reset"`. Nao havia guard nenhum.
 *
 * Promessa de seguranca falsa e pior que ausencia de promessa: quem le B23 acredita que existe uma
 * rede, e age com a confianca de quem tem rede.
 *
 * `NODE_ENV=production` tambem seria a trava errada — ninguem define isso na maquina de
 * desenvolvimento, entao ela nunca dispararia no caso real. O caminho perigoso de verdade e outro:
 * `supabase db reset --linked` apaga o banco do projeto LINKADO, e linkar e passo normal para
 * `db push` e para gerar tipos.
 *
 * Entao a trava aqui olha o que de fato indica perigo, reusando a MESMA regra que
 * `tests/setup/so-banco-local.ts` ja usa e que ja provou valor: se a URL do Supabase nao e local,
 * nao passa. Mais `--linked`/`--db-url`, que sao explicitos demais para deixar escapar.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const ESCAPE = 'PERMITIR_BANCO_REMOTO'
const args = process.argv.slice(2)

function recusar(motivo) {
  console.error(`\n[db:reset] RECUSADO — ${motivo}\n`)
  console.error(`Se voce REALMENTE quer isso, e sabe que nao e o banco de producao, repita com ${ESCAPE}=1.\n`)
  process.exit(1)
}

if (process.env[ESCAPE] !== '1') {
  const explicito = args.find((a) => a === '--linked' || a.startsWith('--db-url'))
  if (explicito) recusar(`\`${explicito}\` aponta para um banco remoto. \`db reset\` APAGA e recria o banco inteiro.`)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const eLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/i.test(url)
  if (url && !eLocal) {
    recusar(
      `NEXT_PUBLIC_SUPABASE_URL aponta para ${url}, que nao e o Supabase local.\n` +
        `  Suba o banco local com \`supabase start\` antes (o \`supabase status\` mostra a URL).`,
    )
  }

  // Projeto linkado + um `--linked` esquecido no historico do shell e o acidente classico.
  if (existsSync('supabase/.temp/project-ref')) {
    console.warn('[db:reset] Aviso: este projeto esta LINKADO a um projeto remoto. Reset segue no banco LOCAL.')
  }
}

execFileSync('supabase', ['db', 'reset', ...args], { stdio: 'inherit' })
