/**
 * Enriquece a barbearia de demonstração (`dom-rocha`) com exemplos das funcionalidades novas de
 * CRM: perfil rico, pontos, clube de assinatura e anotações. Roda por cima do que
 * `seed-demo-barbearia.mjs` já criou — não apaga nada, só complementa alguns clientes escolhidos
 * a dedo para as telas novas terem o que mostrar na demonstração.
 *
 *   node scripts/seed-demo-crm-profundo.mjs
 */
import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function precisa(erro, onde) {
  if (erro) {
    console.error(`falhou em ${onde}:`, erro.message ?? erro)
    process.exit(1)
  }
}

const { data: tenant, error: erroTenant } = await svc.from('tenants').select('id').eq('slug', 'dom-rocha').single()
precisa(erroTenant, 'buscar tenant')
const tenantId = tenant.id

const { data: profissionais, error: erroProfs } = await svc
  .from('professionals')
  .select('id, display_name')
  .eq('tenant_id', tenantId)
precisa(erroProfs, 'buscar profissionais')
const idPorProf = Object.fromEntries(profissionais.map((p) => [p.display_name, p.id]))

const { data: dono } = await svc.from('memberships').select('user_id').eq('tenant_id', tenantId).eq('role', 'owner').single()

async function idDoCliente(nome) {
  const { data, error } = await svc.from('clients').select('id').eq('tenant_id', tenantId).eq('name', nome).single()
  precisa(error, `buscar cliente ${nome}`)
  return data.id
}

// ─────────────────────────────────────────────────────────────── planos

const { data: planosExistentes } = await svc.from('subscription_plans').select('id, name').eq('tenant_id', tenantId)
let idPorPlano = Object.fromEntries((planosExistentes ?? []).map((p) => [p.name, p.id]))

const PLANOS = [
  { name: 'Corte Ilimitado', price_cents: 9990, sessions_per_month: null, benefits: 'Corte quantas vezes quiser no mês, sem taxa extra.' },
  { name: 'Barba em Dia', price_cents: 5990, sessions_per_month: 4, benefits: 'Até 4 barbas por mês, prioridade na agenda.' },
  { name: 'Combo Completo', price_cents: 14990, sessions_per_month: 4, benefits: 'Corte + barba até 4x no mês, 10% off em produtos.' },
]

for (const plano of PLANOS) {
  if (idPorPlano[plano.name]) continue
  const { data, error } = await svc
    .from('subscription_plans')
    .insert({ tenant_id: tenantId, ...plano })
    .select('id')
    .single()
  precisa(error, `criar plano ${plano.name}`)
  idPorPlano[plano.name] = data.id
}
console.log(`planos: ${Object.keys(idPorPlano).length}`)

// ─────────────────────────────────────────────────────────────── perfil, pontos, notas, assinatura

/**
 * Cada entrada é um cliente já existente no seed anterior, com o que ele ganha nesta rodada.
 * Escolhidos a dedo: fiéis/vip ganham perfil completo e assinatura; o resto ganha pontos e nota.
 */
const ENRIQUECER = [
  {
    nome: 'Bruno Almeida',
    perfil: { document: '123.456.789-00', gender: 'Masculino', address: 'Rua Augusta, 900 — Consolação, São Paulo/SP', emergency_contact: 'Marina Almeida (esposa) — (11) 98888-1234', preferred_professional_id: idPorProf['Rafael Rocha'] },
    plano: 'Combo Completo',
    diaCobranca: 5,
    pontos: [
      { points: 50, reason: 'Corte + barba de 20/07' },
      { points: 50, reason: 'Corte + barba de 03/08' },
      { points: -60, reason: 'Resgate: produto pós-barba' },
    ],
    notas: ['Cliente desde a inauguração. Sempre chega 10min antes.', 'Pediu para experimentar navalha nova — aprovou.'],
  },
  {
    nome: 'Diego Fernandes',
    perfil: { document: '234.567.890-11', gender: 'Masculino', preferred_professional_id: idPorProf['Diego Martins'] },
    plano: 'Corte Ilimitado',
    diaCobranca: 10,
    pontos: [
      { points: 30, reason: 'Corte de 12/08' },
      { points: 30, reason: 'Corte de 26/08' },
    ],
    notas: ['Prefere conversa mais quieta, gosta de assistir o próprio corte no espelho.'],
  },
  {
    nome: 'Otávio Pinheiro',
    perfil: { gender: 'Masculino', emergency_contact: 'Filho — (11) 97777-5566' },
    plano: 'Barba em Dia',
    diaCobranca: 15,
    pontos: [{ points: 40, reason: 'Fidelidade — 6 meses de casa' }],
    notas: [],
  },
  {
    nome: 'Henrique Barros',
    perfil: { document: '345.678.901-22', gender: 'Masculino' },
    plano: null,
    diaCobranca: null,
    pontos: [
      { points: 100, reason: 'Bônus de indicação' },
      { points: -50, reason: 'Resgate: desconto no platinado' },
    ],
    notas: ['ALERGIA: pó descolorante comum — usar linha vegana (já sabia, reforçado aqui também).'],
  },
  {
    nome: 'Jorge Anselmo',
    perfil: { preferred_professional_id: idPorProf['Léo Ferreira'] },
    plano: null,
    diaCobranca: null,
    pontos: [{ points: 20, reason: 'Corte de 09/08' }],
    notas: ['Sempre agenda o último horário de sábado — já é praxe.'],
  },
  {
    nome: 'Marcelo Tavares',
    perfil: {},
    plano: null,
    diaCobranca: null,
    pontos: [],
    notas: ['Sumiu depois que mudou de emprego. Bom candidato pra campanha de recuperação.'],
  },
]

for (const item of ENRIQUECER) {
  const clientId = await idDoCliente(item.nome)

  if (Object.keys(item.perfil).length > 0) {
    const { error } = await svc.from('clients').update(item.perfil).eq('id', clientId)
    precisa(error, `atualizar perfil de ${item.nome}`)
  }

  for (const lancamento of item.pontos) {
    const { error } = await svc
      .from('loyalty_entries')
      .insert({ tenant_id: tenantId, client_id: clientId, created_by: dono.user_id, ...lancamento })
    precisa(error, `lançar pontos de ${item.nome}`)
  }

  for (const nota of item.notas) {
    const { error } = await svc
      .from('client_notes')
      .insert({ tenant_id: tenantId, client_id: clientId, body: nota, author_id: dono.user_id })
    precisa(error, `criar nota de ${item.nome}`)
  }

  if (item.plano) {
    const { data: jaTem } = await svc
      .from('client_subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .maybeSingle()
    if (!jaTem) {
      const { error } = await svc.from('client_subscriptions').insert({
        tenant_id: tenantId,
        client_id: clientId,
        plan_id: idPorPlano[item.plano],
        billing_day: item.diaCobranca,
      })
      precisa(error, `assinar plano de ${item.nome}`)
    }
  }

  console.log(`${item.nome}: perfil=${Object.keys(item.perfil).length} pontos=${item.pontos.length} notas=${item.notas.length} plano=${item.plano ?? '—'}`)
}

console.log('pronto')
