// Verificação no navegador do PR #151: sobe o build de produção da worktree ciclo-loja numa porta própria,
// entra com um negócio de teste do banco LOCAL e confere o que o app nativo (User-Agent com CicloApp) vê.
// Uso: node verificar.mjs <raiz-da-worktree> <email> (a senha vem de VERIF_SENHA)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire('C:/Users/Usuario/.claude/code/lubi-demo-generica/package.json')
const { chromium } = require('playwright')

const [, , RAIZ, EMAIL] = process.argv
const SENHA = process.env.VERIF_SENHA
const PORTA = 3041
const BASE = `http://localhost:${PORTA}`
const SAIDA = join(import.meta.dirname, 'saida')
mkdirSync(SAIDA, { recursive: true })

const UA_APP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 CicloApp'
const UA_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

const servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORTA)], {
  cwd: RAIZ,
  env: { ...process.env, NODE_ENV: 'production' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logServidor = ''
servidor.stdout.on('data', (d) => (logServidor += d))
servidor.stderr.on('data', (d) => (logServidor += d))

const resultados = []
const anota = (nome, ok, detalhe = '') => {
  resultados.push({ nome, ok, detalhe })
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? ' · ' + detalhe : ''}`)
}

// Mesmo algoritmo de configurar-status-bar-nativo.tsx, rodado na página de verdade.
const MEDIR_BARRA = `(() => {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const rgba = (cor) => { c.clearRect(0,0,1,1); c.fillStyle='#000'; c.fillStyle=cor; c.fillRect(0,0,1,1); const d=c.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255] }
  let el = document.elementFromPoint(innerWidth/2, 1)
  while (el) { const v = rgba(getComputedStyle(el).backgroundColor); if (v[3] >= 0.5) return v.slice(0,3); el = el.parentElement }
  return null
})()`
const lum = ([r, g, b]) => {
  const k = (x) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b)
}
const icones = (rgb) => { const l = lum(rgb); return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? 'claros' : 'escuros' }

async function esperarServidor() {
  for (let i = 0; i < 90; i++) {
    try { const r = await fetch(`${BASE}/entrar`); if (r.status < 500) return } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('servidor não subiu:\n' + logServidor.slice(-2000))
}

async function entrar(page) {
  await page.goto(`${BASE}/entrar`)
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', SENHA)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL(/\/admin\//, { timeout: 30000 })
  } catch (e) {
    console.log('LOGIN FALHOU, TELA:', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300))
    throw e
  }
}

try {
  await esperarServidor()
  const navegador = await chromium.launch()

  // ── App nativo
  const app = await navegador.newContext({ userAgent: UA_APP, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const pa = await app.newPage()
  const erros = []
  pa.on('pageerror', (e) => erros.push(String(e)))

  await pa.goto(`${BASE}/`)
  anota('app: / abre em /entrar (LOJA-20)', new URL(pa.url()).pathname === '/entrar', pa.url())
  await pa.goto(`${BASE}/precos`)
  anota('app: /precos abre em /entrar (LOJA-20)', new URL(pa.url()).pathname === '/entrar', pa.url())
  const social = await pa.locator('text=/Entrar com (Google|Apple)|Continuar com (Google|Apple)/').count()
  anota('app: /entrar sem botão de Google ou Apple (LOJA-21)', social === 0, `${social} botões`)
  const barraEntrar = await pa.evaluate(MEDIR_BARRA)
  // /entrar é CLARA (#faf8f5): a suposição de "frente de casa escura" estava errada; a medida decide.
  anota('app: barra em /entrar (tela clara medida) pede ícones escuros (LOJA-30)', barraEntrar && icones(barraEntrar) === 'escuros', JSON.stringify(barraEntrar))
  await pa.screenshot({ path: join(SAIDA, 'app-entrar.png') })

  await entrar(pa)
  anota('app: login leva ao painel', /\/admin\//.test(pa.url()), pa.url())
  await pa.goto(`${BASE}/admin/hoje`)
  await pa.waitForLoadState('networkidle')
  const barraHoje = await pa.evaluate(MEDIR_BARRA)
  anota('app: barra no Hoje (painel claro) pede ícones escuros (LOJA-30)', barraHoje && icones(barraHoje) === 'escuros', JSON.stringify(barraHoje))
  await pa.screenshot({ path: join(SAIDA, 'app-hoje.png') })

  await pa.goto(`${BASE}/admin/config`)
  const itemNotif = await pa.locator('a[href="/admin/config/notificacoes"]').count()
  anota('app: Configurações sem o item Notificações (LOJA-24)', itemNotif === 0, `${itemNotif} links`)
  await pa.screenshot({ path: join(SAIDA, 'app-config.png'), fullPage: true })

  await pa.goto(`${BASE}/admin/config/notificacoes`)
  const txtNotif = await pa.locator('main').innerText()
  anota('app: Notificações aberta por link não fala em Safari nem navegador (LOJA-24)', /ainda não chegam pelo app/.test(txtNotif) && !/Safari|navegador|Tela de Início/i.test(txtNotif), txtNotif.replace(/\s+/g, ' ').slice(0, 140))
  await pa.screenshot({ path: join(SAIDA, 'app-notificacoes.png') })

  const respostaConta = pa.waitForResponse((r) => r.url().endsWith('/api/v1/account') && r.request().method() === 'GET', { timeout: 30000 })
  await pa.goto(`${BASE}/admin/config/excluir-conta`)
  const rc = await respostaConta
  console.log('GET /api/v1/account', rc.status(), (await rc.text()).slice(0, 300))
  await pa.waitForSelector('text=Conferindo sua conta', { state: 'detached', timeout: 20000 })
  const falso = await pa.locator('text=Não consegui verificar sua conta').count()
  anota('app: Excluir conta sem segundo fator não mostra erro falso de conexão (LOJA-27)', falso === 0)
  await pa.screenshot({ path: join(SAIDA, 'app-excluir-conta-antes.png'), fullPage: true })
  console.log('TELA EXCLUIR:', (await pa.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 600))
  await pa.getByRole('button', { name: 'Excluir minha conta' }).click()
  const botaoFinal = pa.getByRole('button', { name: 'Excluir mesmo assim' })
  await botaoFinal.waitFor()
  await pa.waitForTimeout(800) // a folha sobe animada
  const caixa = await botaoFinal.boundingBox()
  anota('app: botão "Excluir mesmo assim" inteiro dentro da tela de 844 px', !!caixa && caixa.y >= 0 && caixa.y + caixa.height <= 844 && caixa.height >= 44, JSON.stringify(caixa))
  const texto = await pa.locator('main').innerText()
  anota('app: texto da exclusão sem "de o negócio"', !/\bde o(s)? negócio/.test(texto) && /do negócio abaixo/.test(texto))
  const campoSenha = await pa.locator('input[name="password"]').count()
  anota('app: login recente, a folha confirma sem pedir senha (LOJA-27)', campoSenha === 0, `${campoSenha} campos de senha`)
  await pa.screenshot({ path: join(SAIDA, 'app-excluir-conta.png') })
  anota('app: nenhum erro de JavaScript na página', erros.length === 0, erros.join(' | ').slice(0, 200))

  // ── Navegador comum: nada muda
  const web = await navegador.newContext({ userAgent: UA_SAFARI, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const pw = await web.newPage()
  await pw.goto(`${BASE}/`)
  anota('navegador: / continua sendo a landing', new URL(pw.url()).pathname === '/', pw.url())
  await pw.goto(`${BASE}/precos`)
  anota('navegador: /precos continua abrindo', new URL(pw.url()).pathname === '/precos', pw.url())
  await entrar(pw)
  await pw.goto(`${BASE}/admin/config`)
  await pw.screenshot({ path: join(SAIDA, 'web-config.png'), fullPage: true })
  console.log('WEB CONFIG:', pw.url(), (await pw.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900))
  const nWeb = await pw.locator('a[href="/admin/config/notificacoes"]').count()
  anota('navegador: Configurações mostra Notificações', nWeb >= 1, `${nWeb} links`)
  await pw.goto(`${BASE}/admin/config/notificacoes`)
  await pw.waitForLoadState('networkidle')
  const txtWeb = (await pw.locator('main').innerText()).replace(/\s+/g, ' ')
  anota('navegador: Notificações mostra o Web Push (não a frase do app)', !/ainda não chegam pelo app/.test(txtWeb), txtWeb.slice(0, 160))

  // ── APR-611: sem rede, navegar no painel mostra a página local, e nada do painel fica no cache
  await pw.goto(`${BASE}/admin/hoje`)
  await pw.evaluate(() => navigator.serviceWorker.ready)
  await pw.reload()
  await pw.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 })
  await web.setOffline(true)
  await pw.goto(`${BASE}/admin/agenda`).catch(() => {})
  const offline = await pw.locator('body').innerText().catch(() => '')
  anota('navegador sem rede: painel mostra "Não conseguimos abrir o CICLO" (APR-611)', /Não conseguimos abrir o CICLO/.test(offline), offline.replace(/\s+/g, ' ').slice(0, 120))
  await pw.screenshot({ path: join(SAIDA, 'web-sem-internet.png') })
  const doCache = await pw.evaluate(async () => {
    const urls = []
    for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname)
    return urls
  })
  anota('navegador: nenhuma tela do painel ou da API no cache do SW', !doCache.some((u) => /^\/(admin|api|entrar)/.test(u)) && doCache.includes('/sem-internet.html'), doCache.join(' ').slice(0, 200))
  await web.setOffline(false)

  await navegador.close()
} catch (e) {
  anota('roteiro', false, String(e).slice(0, 400))
} finally {
  servidor.kill()
  writeFileSync(join(SAIDA, 'resultado.json'), JSON.stringify(resultados, null, 2))
  const falhas = resultados.filter((r) => !r.ok).length
  console.log(`\n${resultados.length - falhas}/${resultados.length} conferências ok`)
  process.exit(falhas ? 1 : 0)
}
