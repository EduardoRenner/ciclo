#!/usr/bin/env node
/**
 * Métricas de ativação e retenção — docs/18-MONETIZACAO-PLANO.md §O.1.
 *
 * O §13.2 do `09-PLATAFORMA.md` definiu as métricas que dizem se o produto funciona, e a linha
 * seguinte admitia: "nenhuma instrumentada". A Fase O do plano de monetização observou que boa
 * parte delas **não precisa de instrumentação nenhuma** — sai dos timestamps que já existem.
 * Este script é essa observação virando número.
 *
 * ## Como usar
 *
 *   node scripts/metricas-ativacao.mjs
 *
 * Lê `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` do `.env.local`.
 *
 * ## SÓ LEITURA
 *
 * Nenhum `insert`, `update` ou `delete`. É deliberado e não é escrúpulo: o `.env.local` deste
 * projeto aponta para o Supabase de PRODUÇÃO (ver `docs/DECISOES.md`), então qualquer script
 * daqui escreve na base real. Um medidor que altera o que mede não é medidor.
 *
 * ## O que ele NÃO mede, e por quê
 *
 * Conversão grátis→pago, MRR e churn de receita exigem cobrança, que não existe. Onde a pessoa
 * abandona o onboarding passo a passo exige evento de front, que não existe. Estão na §O.2 do
 * plano como "exige instrumentação nova" — e continuam lá.
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

const db = createClient(URL, CHAVE, { auth: { persistSession: false, autoRefreshToken: false } })

const DIA = 86_400_000

/** Tenants de fixture de teste. Contá-los como negócio real é o defeito que o §P.1.1 descreve. */
const RESIDUO_DE_TESTE = /^(health|alertas-estoque|recuperar|clientes|risco|teste)-[0-9a-f]{6,}$/

function dias(de, ate) {
  return (new Date(ate).getTime() - new Date(de).getTime()) / DIA
}

function mediana(numeros) {
  if (numeros.length === 0) return null
  const ord = [...numeros].sort((a, b) => a - b)
  const meio = Math.floor(ord.length / 2)
  return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2
}

function pct(parte, todo) {
  return todo === 0 ? '—' : `${Math.round((parte / todo) * 100)}%`
}

async function tudo(tabela, colunas) {
  const { data, error } = await db.from(tabela).select(colunas)
  if (error) throw new Error(`${tabela}: ${error.message}`)
  return data ?? []
}

const tenants = await tudo('tenants', 'id, slug, created_at, deleted_at')
const servicos = await tudo('services', 'tenant_id, created_at')
const profissionais = await tudo('professionals', 'tenant_id, created_at')
const agendamentos = await tudo('appointments', 'tenant_id, created_at, origin, starts_at')

const reais = tenants.filter((t) => !t.deleted_at && !RESIDUO_DE_TESTE.test(t.slug))
const residuo = tenants.filter((t) => RESIDUO_DE_TESTE.test(t.slug))

const porTenant = (linhas) => {
  const m = new Map()
  for (const l of linhas) {
    const atual = m.get(l.tenant_id)
    if (!atual || l.created_at < atual) m.set(l.tenant_id, l.created_at)
  }
  return m
}

const primeiroServico = porTenant(servicos)
const primeiroProfissional = porTenant(profissionais)
const primeiroAgendamento = porTenant(agendamentos)

// "Ativado" = saiu do cadastro com serviço E profissional. É o que o §13.2 chama de sair com
// "serviço + horário + link" — o link existe assim que o tenant existe, então o que resta medir
// é a configuração mínima que faz a página pública ter o que mostrar.
const ativados = reais.filter((t) => primeiroServico.has(t.id) && primeiroProfissional.has(t.id))

const temposAteConfig = ativados
  .map((t) => {
    const s = primeiroServico.get(t.id)
    const p = primeiroProfissional.get(t.id)
    return dias(t.created_at, s > p ? s : p) * 24 * 60
  })
  .filter((n) => n >= 0)

const comAgendamento = reais.filter((t) => primeiroAgendamento.has(t.id))
const temposAte1oAgendamento = comAgendamento
  .map((t) => dias(t.created_at, primeiroAgendamento.get(t.id)))
  .filter((n) => n >= 0)

// O momento "aha" da §I.1: o primeiro agendamento que chega SOZINHO pela página pública.
// `origin`, e o valor é `public_page` — conferido no enum `appointment_origin` do schema.
const publicos = agendamentos.filter((a) => a.origin === 'public_page')
const tenantsComAgendamentoPublico = new Set(publicos.map((a) => a.tenant_id))

const agora = Date.now()
const ativoNosUltimos = (d) => {
  const corte = agora - d * DIA
  const vivos = new Set(
    agendamentos.filter((a) => new Date(a.created_at).getTime() >= corte).map((a) => a.tenant_id),
  )
  return reais.filter((t) => vivos.has(t.id))
}

const maduros = (d) => reais.filter((t) => agora - new Date(t.created_at).getTime() >= d * DIA)
const retidos = (d) => {
  const base = maduros(d)
  const vivos = new Set(ativoNosUltimos(30).map((t) => t.id))
  return { base: base.length, retidos: base.filter((t) => vivos.has(t.id)).length }
}

const linha = (rotulo, valor, nota = '') => console.log(`  ${rotulo.padEnd(38)} ${String(valor).padStart(8)}  ${nota}`)

console.log('\n═══ ATIVAÇÃO E RETENÇÃO ═══  (docs/18-MONETIZACAO-PLANO.md §O.1)\n')

console.log('BASE')
linha('Tenants no banco', tenants.length)
linha('Resíduo de suíte de teste', residuo.length, residuo.length ? '⚠️ ver §P.1.1 do plano' : '')
linha('Tenants reais', reais.length, reais.length < 10 ? '⚠️ amostra pequena demais para tendência' : '')
console.log('')

console.log('ATIVAÇÃO   (§13.2: alvo > 60%, e < 3 min de mediana)')
linha('Saíram do cadastro configurados', `${ativados.length}/${reais.length}`, pct(ativados.length, reais.length))
linha('Mediana até configurar (min)', mediana(temposAteConfig)?.toFixed(1) ?? '—')
console.log('')

console.log('PRIMEIRO AGENDAMENTO   (§13.2: alvo < 7 dias)')
linha('Já tiveram algum', `${comAgendamento.length}/${reais.length}`, pct(comAgendamento.length, reais.length))
linha('Mediana até o 1º (dias)', mediana(temposAte1oAgendamento)?.toFixed(1) ?? '—')
console.log('')

console.log('MOMENTO "AHA"   (§I.1: o 1º agendamento que chega sozinho)')
linha('Tenants que já receberam um', `${tenantsComAgendamentoPublico.size}/${reais.length}`, pct(tenantsComAgendamentoPublico.size, reais.length))
linha('Agendamentos pela página pública', `${publicos.length}/${agendamentos.length}`, pct(publicos.length, agendamentos.length))
console.log('')

console.log('RETENÇÃO   (ativo = criou agendamento nos últimos 30 dias)')
for (const d of [30, 90]) {
  const r = retidos(d)
  linha(`Com ${d}+ dias de casa, ainda ativos`, `${r.retidos}/${r.base}`, pct(r.retidos, r.base))
}
console.log('')

console.log('SINAIS DE CHURN   (§I.3)')
const semAgendamentoHa14 = reais.filter((t) => {
  const ultimo = agendamentos
    .filter((a) => a.tenant_id === t.id)
    .map((a) => new Date(a.created_at).getTime())
    .sort((a, b) => b - a)[0]
  return !ultimo || agora - ultimo > 14 * DIA
})
linha('Sem criar agendamento há 14+ dias', `${semAgendamentoHa14.length}/${reais.length}`, pct(semAgendamentoHa14.length, reais.length))
if (semAgendamentoHa14.length) console.log(`     ${semAgendamentoHa14.map((t) => t.slug).join(', ')}`)

/*
 * A parte mais importante da saída, e a razão de este bloco existir.
 *
 * Uma base semeada por script produz 100% de ativação em 0 minuto — porque tenant, serviço e
 * profissional nascem na mesma transação. Ler isso como "o onboarding funciona" é o defeito que o
 * §2.4 do prompt de monetização chama de Suposto apresentado como Medido, e seria pior que não
 * medir nada: dá confiança falsa num número que não descreve pessoa nenhuma.
 *
 * A heurística é grosseira de propósito: gente de verdade leva minutos, não segundos.
 */
const medianaConfig = mediana(temposAteConfig)
const cheiroDeSeed = medianaConfig !== null && medianaConfig < 1 && reais.length > 0

console.log('───')
if (cheiroDeSeed) {
  console.log('⚠️  ESTES NÚMEROS NÃO DESCREVEM USO REAL.')
  console.log('')
  console.log(`    A mediana de configuração é ${medianaConfig.toFixed(2)} min — tenant, serviço e profissional`)
  console.log('    nasceram juntos, que é assinatura de base criada por script de seed, não de')
  console.log('    alguém preenchendo formulário. Ativação de 100% aqui mede o seed, não o produto.')
  console.log('')
  console.log('    Vale como fumaça: o script roda, as consultas estão certas e os campos existem.')
  console.log('    Não vale como evidência de nada sobre onboarding, ativação ou retenção.')
} else {
  console.log('Os tempos parecem de uso real (mediana de configuração acima de 1 minuto).')
}

console.log('')
console.log('Não medido aqui (§O.2, exige instrumentação nova): conversão grátis→pago, MRR, churn')
console.log('de receita, e onde a pessoa abandona o onboarding passo a passo.\n')
