// LOJA-51: imagens das lojas a partir do build de produção desta worktree, com negócio FICTÍCIO do banco local.
// Simula o app (User-Agent CicloApp), tema claro. Um login só; os cookies valem para os dois tamanhos.
// Uso: node capturas-loja.mjs <raiz> <email> <clienteId> <pasta-saida>  (senha em VERIF_SENHA)
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire('C:/Users/Usuario/.claude/code/lubi-demo-generica/package.json')
const { chromium } = require('playwright')
const [, , RAIZ, EMAIL, CLIENTE, SAIDA] = process.argv
const PORTA = 3043
const BASE = `http://localhost:${PORTA}`
const UA_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CicloApp'

const servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORTA)], {
  cwd: RAIZ, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'ignore',
})

const TELAS = [
  ['1-hoje', '/admin/hoje'],
  ['2-clientes', '/admin/clientes'],
  ['3-ficha-do-cliente', `/admin/clientes/${CLIENTE}`],
  ['4-agenda', '/admin/agenda'],
  ['5-recuperar', '/admin/recuperar'],
  ['6-mes', '/admin/mes'],
]
const TAMANHOS = [
  ['app-store-6.9', { width: 440, height: 956 }, 3],
  ['google-play', { width: 360, height: 720 }, 3],
]

try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${BASE}/entrar`)).status < 500) break } catch {} await new Promise((r) => setTimeout(r, 1000)) }
  // Rodar o Motor de Ciclo como o agendador faria (banco LOCAL). O segredo vem do .env.local e não é impresso.
  const env = Object.fromEntries((await import('node:fs')).readFileSync(join(RAIZ, '.env.local'), 'utf8').split(String.fromCharCode(10)).map((l) => l.trimEnd()).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
  if (!/^http:\/\/127\.0\.0\.1/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) throw new Error('o .env.local não aponta para o banco local: parando')
  const motor = await fetch(`${BASE}/api/cron/recompute-cycles`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })
  console.log('Motor:', motor.status, (await motor.text()).slice(0, 160))
  const nav = await chromium.launch()
  const login = await nav.newContext({ userAgent: UA_APP, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const p0 = await login.newPage()
  await p0.goto(`${BASE}/entrar`)
  await p0.fill('input[name="email"]', EMAIL)
  await p0.fill('input[name="password"]', process.env.VERIF_SENHA)
  await p0.click('button[type="submit"]')
  await p0.waitForURL(/\/admin\//, { timeout: 30000 })
  const estado = await login.storageState()
  await login.close()

  for (const [nomeTam, viewport, escala] of TAMANHOS) {
    const pasta = join(SAIDA, nomeTam)
    mkdirSync(pasta, { recursive: true })
    const ctx = await nav.newContext({ userAgent: UA_APP, viewport, deviceScaleFactor: escala, isMobile: true, hasTouch: true, storageState: estado, colorScheme: 'light' })
    const page = await ctx.newPage()
    for (const [nome, url] of TELAS) {
      await page.goto(BASE + url, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      // O botão flutuante do assistente não está na conta do revisor sem chave de IA garantida (regra 2.3): fora da imagem.
      await page.addStyleTag({ content: '[aria-label*="ssistente" i]{visibility:hidden !important}' })
      await page.screenshot({ path: join(pasta, `${nome}.png`) })
      console.log(nomeTam, nome, page.url())
    }
    await ctx.close()
  }
  await nav.close()
} finally {
  servidor.kill()
}
