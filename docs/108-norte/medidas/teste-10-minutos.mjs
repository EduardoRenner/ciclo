// Teste de 10 minutos do kit de campo (docs/108-norte/02-kit-de-campo.md), medido no navegador a 390 px,
// contra o Supabase local isolado da integração. Uma conta nova por nicho: entrar, primeiros passos,
// perguntas, trazer 20 de memória (colando a lista), ver a fila e o "Chamar".
// Uso: node teste-10-minutos.mjs <baseURL> <supabaseURL> <serviceKey> <pastaDeSaida>
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'

const require = createRequire('C:/Users/Usuario/.claude/code/lubi-demo-generica/package.json')
const { chromium } = require('playwright')

const [BASE, SUPA, CHAVE, SAIDA] = process.argv.slice(2)
mkdirSync(SAIDA, { recursive: true })

const NICHOS = [
  { profissao: 'Cílios', negocio: 'Studio Olhar Teste' },
  { profissao: 'Sobrancelhas', negocio: 'Design Sobrancelha Teste' },
  { profissao: 'Unhas', negocio: 'Esmalteria Teste' },
  { profissao: 'Barbearia', negocio: 'Barbeiro Solo Teste' },
]

const NOMES = ['Ana', 'Bruna', 'Carla', 'Daniela', 'Elisa', 'Fernanda', 'Gabriela', 'Helena', 'Isabela', 'Juliana',
  'Karina', 'Larissa', 'Marina', 'Natália', 'Olívia', 'Paula', 'Quésia', 'Renata', 'Sabrina', 'Tatiana']

async function admin(caminho, corpo) {
  const r = await fetch(`${SUPA}${caminho}`, {
    method: 'POST',
    headers: { apikey: CHAVE, authorization: `Bearer ${CHAVE}`, 'content-type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`)
  return r.json()
}

async function medirTela(pagina) {
  return pagina.evaluate(() => ({ larguraConteudo: document.documentElement.scrollWidth, larguraTela: window.innerWidth }))
}

const resultados = []
const navegador = await chromium.launch()
for (const nicho of NICHOS) {
  const r = { nicho: nicho.profissao, passos: [], problemas: [] }
  const marca = randomUUID().slice(0, 6)
  const email = `campo-${marca}@ciclo.test`
  const senha = randomUUID()
  await admin('/auth/v1/admin/users', { email, password: senha, email_confirm: true, user_metadata: { full_name: 'Pessoa do Teste' } })

  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const pagina = await contexto.newPage()
  const errosDoConsole = []
  pagina.on('console', (m) => { if (m.type() === 'error') errosDoConsole.push(m.text().slice(0, 200)) })
  const passo = async (nome, fn) => {
    const t0 = Date.now()
    try {
      await fn()
      const tela = await medirTela(pagina)
      if (tela.larguraConteudo > tela.larguraTela + 1) r.problemas.push(`${nome}: rolagem lateral (${tela.larguraConteudo}px numa tela de ${tela.larguraTela}px)`)
      r.passos.push({ nome, ms: Date.now() - t0, ok: true })
    } catch (e) {
      r.passos.push({ nome, ms: Date.now() - t0, ok: false, erro: String(e.message).slice(0, 300) })
      await pagina.screenshot({ path: `${SAIDA}/${nicho.profissao}-falhou-${nome}.png` }).catch(() => {})
      throw e
    }
  }
  try {
    await passo('entrar', async () => {
      await pagina.goto(`${BASE}/entrar`)
      await pagina.getByLabel('E-mail').fill(email)
      await pagina.getByLabel('Senha', { exact: true }).fill(senha)
      await pagina.getByRole('button', { name: 'Entrar' }).click()
      await pagina.waitForURL(/\/onboarding/, { timeout: 20000 })
    })
    await passo('primeiros-passos', async () => {
      await pagina.getByLabel('Nome do negócio').fill(`${nicho.negocio} ${marca}`)
      const oficina = await pagina.getByRole('button', { name: 'Oficina mecânica' }).count()
      if (oficina > 0) r.problemas.push('primeiros-passos: "Oficina mecânica" aparece na lista de profissões (o pacote devia estar fechado)')
      await pagina.getByLabel('Sua profissão').fill(nicho.profissao.slice(0, 5))
      await pagina.getByRole('button', { name: nicho.profissao, exact: true }).click()
      await pagina.screenshot({ path: `${SAIDA}/${nicho.profissao}-1-primeiros-passos.png`, fullPage: true })
      await pagina.getByRole('button', { name: 'Colocar minha página no ar' }).click()
      await pagina.waitForURL(/\/onboarding\/perfil|\/admin/, { timeout: 30000 })
    })
    await passo('perguntas', async () => {
      if (!/perfil/.test(pagina.url())) { r.problemas.push(`perguntas: depois dos primeiros passos foi para ${new URL(pagina.url()).pathname}, não para as perguntas`); return }
      await pagina.getByRole('radio', { name: 'Na minha cabeça ou num caderno' }).click()
      for (let i = 0; i < 20 && !/ja-atendo/.test(pagina.url()); i++) {
        await pagina.waitForTimeout(500)
        if (/ja-atendo/.test(pagina.url())) break
        const soEu = pagina.locator('button:enabled', { hasText: /^Só eu/ })
        if (await soEu.count()) { await soEu.first().click(); continue }
        const pular = pagina.locator('button:enabled', { hasText: /Pular esta pergunta/ })
        if (await pular.count()) { await pular.first().click(); continue }
      }
      await pagina.waitForURL(/ja-atendo/, { timeout: 20000 })
    })
    await passo('trazer-20-de-memoria', async () => {
      for (const [lote, quando] of [[NOMES.slice(0, 10), 'quinzena'], [NOMES.slice(10), 'mes']]) {
        await pagina.getByRole('button', { name: 'Colar uma lista' }).click()
        await pagina.getByLabel('Cole a lista, um nome por linha').fill(lote.map((n) => `${n} ${marca}`).join('\n'))
        await pagina.getByLabel('Quando essas pessoas vieram, mais ou menos?').selectOption(quando)
        await pagina.getByRole('button', { name: /^Pôr \d+ na lista$/ }).click()
      }
      await pagina.screenshot({ path: `${SAIDA}/${nicho.profissao}-2-lista.png`, fullPage: true })
      const botao = pagina.getByRole('button', { name: /^Pôr \d+ pessoas? no Motor$/ })
      r.botaoMotor = (await botao.textContent())?.trim()
      await botao.click()
      await pagina.getByText(/(pessoa|pessoas) já (está|estão) atrasad|Adicionar mais gente/i).first().waitFor({ timeout: 20000 })
      r.cartao = (await pagina.locator('main').innerText()).split('\n').filter((l) => /atrasad|Motor de Ciclo já|atualizad/i.test(l)).slice(0, 3)
      await pagina.screenshot({ path: `${SAIDA}/${nicho.profissao}-3-resultado.png`, fullPage: true })
    })
    await passo('fila', async () => {
      await pagina.goto(`${BASE}/admin/recuperar`)
      await pagina.getByText('Dá para recuperar').first().waitFor({ timeout: 20000 })
      const texto = await pagina.locator('main').innerText()
      const m = texto.match(/d[áa] para recuperar\s*(R\$\s*[\d.,]+)/i)
      r.daParaRecuperar = m ? `Dá para recuperar ${m[1]}` : 'Dá para recuperar: valor não encontrado'
      const linha = texto.match(/\n([^\n]+) · \d+d de/)
      r.servicoNaFila = linha ? linha[1] : null
      r.temLucroNaTela = /de lucro/.test(texto)
      const chamar = pagina.locator('a[href*="wa.me"]').first()
      r.chamarAbreWhatsApp = (await chamar.count()) > 0
      if (r.chamarAbreWhatsApp) {
        const href = await chamar.getAttribute('href')
        r.textoDaMensagem = decodeURIComponent(href.split('text=')[1] ?? '').slice(0, 160)
      } else r.problemas.push('fila: nenhum botão de Chamar pelo WhatsApp')
      await pagina.screenshot({ path: `${SAIDA}/${nicho.profissao}-4-recuperar.png`, fullPage: true })
    })
  } catch {
    // o passo que falhou já ficou registrado com a captura
  }
  r.errosDoConsole = [...new Set(errosDoConsole)].slice(0, 5)
  r.totalSegundos = Math.round(r.passos.reduce((s, p) => s + p.ms, 0) / 100) / 10
  resultados.push(r)
  await contexto.close()
}
await navegador.close()
writeFileSync(`${SAIDA}/resultado.json`, JSON.stringify(resultados, null, 2))
for (const r of resultados) {
  console.log(`== ${r.nicho}: ${r.passos.map((p) => `${p.nome}${p.ok ? '' : ' FALHOU'} ${Math.round(p.ms / 100) / 10}s`).join(' · ')} · total ${r.totalSegundos}s`)
  if (r.botaoMotor) console.log(`   botão: ${r.botaoMotor} · cartão: ${JSON.stringify(r.cartao)}`)
  if (r.daParaRecuperar) console.log(`   ${r.daParaRecuperar} · serviço na fila: ${r.servicoNaFila} · "de lucro" na tela: ${r.temLucroNaTela} · Chamar abre WhatsApp: ${r.chamarAbreWhatsApp}`)
  if (r.textoDaMensagem) console.log(`   mensagem: ${r.textoDaMensagem}`)
  for (const p of r.passos.filter((p) => !p.ok)) console.log(`   ERRO em ${p.nome}: ${p.erro}`)
  for (const pr of r.problemas) console.log(`   PROBLEMA ${pr}`)
  if (r.errosDoConsole.length) console.log(`   console: ${r.errosDoConsole.join(' | ')}`)
}
