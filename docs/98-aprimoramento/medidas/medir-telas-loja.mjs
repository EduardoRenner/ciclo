// Faixa 2 (docs/98-aprimoramento/11): tempo das 10 telas do dono no build de produção desta worktree.
// 390x844, CPU 4x mais lenta (celular médio), banco LOCAL. Cada tela: 1ª visita e 2ª visita (cache do navegador).
// Uso: node medir-telas.mjs <raiz> <email> <appointmentId>  (senha em VERIF_SENHA)
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire('C:/Users/Usuario/.claude/code/lubi-demo-generica/package.json')
const { chromium } = require('playwright')
const [, , RAIZ, EMAIL, AGENDAMENTO] = process.argv
const PORTA = 3042
const BASE = `http://localhost:${PORTA}`

const servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORTA)], {
  cwd: RAIZ, env: { ...process.env, NODE_ENV: 'production' }, stdio: 'ignore',
})

const TELAS = [
  ['Entrar', '/entrar', false],
  ['Cadastro', '/cadastro', false],
  ['Hoje', '/admin/hoje', true],
  ['Agenda', '/admin/agenda', true],
  ['Comanda e Receber', `/admin/comanda/agendamento/${AGENDAMENTO}`, true],
  ['Clientes', '/admin/clientes', true],
  ['Recuperar', '/admin/recuperar', true],
  ['Caixa', '/admin/caixa', true],
  ['Serviços', '/admin/config/servicos', true],
  ['Mês', '/admin/mes', true],
]

const COLETAR = `new Promise((ok) => {
  let lcp = 0, cls = 0
  new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value }).observe({ type: 'layout-shift', buffered: true })
  setTimeout(() => {
    const n = performance.getEntriesByType('navigation')[0]
    const bytes = performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), n.transferSize || 0)
    ok({ ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), lcp: Math.round(lcp), cls: Math.round(cls * 1000) / 1000, kb: Math.round(bytes / 1024), larguraExtra: document.documentElement.scrollWidth - innerWidth })
  }, 1500)
})`

async function esperar() {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${BASE}/entrar`)).status < 500) return } catch {} await new Promise((r) => setTimeout(r, 1000)) }
  throw new Error('servidor não subiu')
}

const linhas = []
try {
  await esperar()
  const nav = await chromium.launch()
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  // Aquecer o servidor (primeira compilação de rota do next start não é o que o usuário vê depois do deploy).
  for (const [, url, priv] of TELAS) if (!priv) await page.goto(BASE + url)
  await page.goto(`${BASE}/entrar`)
  await page.fill('input[name="email"]', EMAIL)
  await page.fill('input[name="password"]', process.env.VERIF_SENHA)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/admin\//, { timeout: 30000 })
  for (const [, url, priv] of TELAS) if (priv) await page.goto(BASE + url)

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  if (!process.env.SO_TROCAS) for (const [nome, url] of TELAS) {
    const medidas = []
    for (const visita of [1, 2]) {
      await page.goto(BASE + url, { waitUntil: 'load' })
      medidas.push({ visita, ...(await page.evaluate(COLETAR)) })
    }
    linhas.push({ nome, url, medidas })
    console.log(nome.padEnd(18), medidas.map((m) => `v${m.visita}: TTFB ${m.ttfb} · LCP ${m.lcp} · CLS ${m.cls} · ${m.kb} KB · +${m.larguraExtra}px`).join('  |  '))
  }

  // Troca de tela pela barra de baixo (navegação do cliente, sem recarregar): toque até o título novo aparecer.
  await page.goto(`${BASE}/admin/hoje`, { waitUntil: 'load' })
  const trocas = []
  const TITULO = { Agenda: /Agenda/, Clientes: /Clientes/, Hoje: /Hoje|Bom dia|Boa tarde|Boa noite/ }
  for (let rodada = 1; rodada <= 3; rodada++) {
    for (const [rotulo, caminho] of [['Agenda', '/admin/agenda'], ['Clientes', '/admin/clientes'], ['Hoje', '/admin/hoje']]) {
      const t0 = Date.now()
      await page.locator('nav').getByRole('link', { name: rotulo }).first().click()
      await page.waitForURL((u) => u.pathname === caminho, { timeout: 15000 })
      await page.locator('main h1').filter({ hasText: TITULO[rotulo] }).first().waitFor({ timeout: 15000 }).catch(() => {})
      trocas.push({ rodada, para: rotulo, ms: Date.now() - t0 })
    }
  }
  console.log('Troca pela barra:', trocas.map((t) => `r${t.rodada} ${t.para} ${t.ms} ms`).join(' · '))
  linhas.push({ trocas })
  await nav.close()
} finally {
  servidor.kill()
  writeFileSync(join(import.meta.dirname, 'saida', 'medidas-telas.json'), JSON.stringify(linhas, null, 2))
}
