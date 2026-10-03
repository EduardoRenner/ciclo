import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { gravarRespostaDePerfil } from '@/server/services/perfil-onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Este teste precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/**
 * `docs/83-ONBOARDING-E-MIGRACAO-PLANO.md` §5.1/§9 (P1): a tela "Pra deixar o CICLO do seu jeito"
 * grava `perfil_respondido` (com `meta = { base_em, sistema? }`) ou `perfil_pulado`, na mesma
 * tabela `product_events` que `conta_criada`/`motor_viu_valor` já usam. Este arquivo prova o
 * caminho feliz de responder (com e sem sub-seleção de sistema) e o caminho de pular — contra o
 * banco local de verdade, não contra um mock que confirmaria só a própria implementação.
 */
const tenants: string[] = []
const usuarios: string[] = []

async function novoTenant() {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `pf-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Perfil',
    vertical: 'barber',
    slug: `pf-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)
  return tenant.id
}

async function eventosDoTenant(tenantId: string) {
  const { data } = await svc.from('product_events').select('event_type, meta').eq('tenant_id', tenantId).neq('event_type', 'conta_criada').neq('event_type', 'cortesia_concedida')
  return data ?? []
}

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('gravarRespostaDePerfil', () => {
  it(
    'responder grava perfil_respondido com base_em — caminho feliz sem sub-seleção',
    async () => {
      const tenantId = await novoTenant()
      await gravarRespostaDePerfil(svc, tenantId, { acao: 'responder', baseEm: 'planilha' })

      expect(await eventosDoTenant(tenantId)).toEqual([{ event_type: 'perfil_respondido', meta: { base_em: 'planilha' } }])
    },
    30_000,
  )

  it(
    'responder "outro sistema" grava base_em e sistema juntos',
    async () => {
      const tenantId = await novoTenant()
      await gravarRespostaDePerfil(svc, tenantId, { acao: 'responder', baseEm: 'outro_sistema', sistema: 'appbarber' })

      expect(await eventosDoTenant(tenantId)).toEqual([
        { event_type: 'perfil_respondido', meta: { base_em: 'outro_sistema', sistema: 'appbarber' } },
      ])
    },
    30_000,
  )

  it(
    'pular grava perfil_pulado, sem meta — mesmo caminho do botão do topo ou do da pergunta',
    async () => {
      const tenantId = await novoTenant()
      await gravarRespostaDePerfil(svc, tenantId, { acao: 'pular' })

      expect(await eventosDoTenant(tenantId)).toEqual([{ event_type: 'perfil_pulado', meta: {} }])
    },
    30_000,
  )
})

/**
 * docs/83 P5 — as Perguntas 2 e 3 só existem porque MUDAM o painel. Estes casos provam o efeito de
 * cada uma contra o banco, e as duas travas: sem `tenant:update` nada muda; e "Eu e mais gente"
 * nunca libera o que o plano não libera.
 */
describe('P5 — as respostas mudam o painel de verdade', () => {
  const settingsDe = async (id: string) => (await svc.from('tenants').select('settings').eq('id', id).single()).data?.settings as Record<string, unknown>
  const desligados = async (id: string) =>
    ((await svc.from('tenant_modules').select('modulo, ligado').eq('tenant_id', id)).data ?? []).filter((m) => !m.ligado).map((m) => m.modulo)

  it(
    'dono escolhe a dor: grava dor_principal nas settings, sem apagar o resto das settings',
    async () => {
      const id = await novoTenant()
      const antes = await settingsDe(id)
      const r = await gravarRespostaDePerfil(svc, id, { acao: 'responder', dor: 'quanto_sobra' }, 'owner')
      expect(r.efeitos).toEqual(['dor_principal:quanto_sobra'])
      const depois = await settingsDe(id)
      expect(depois.dor_principal).toBe('quanto_sobra')
      for (const chave of Object.keys(antes ?? {})) expect(depois, `a chave ${chave} sumiu das settings`).toHaveProperty(chave)
    },
    60_000,
  )

  it(
    'dono responde "Só eu": o módulo de equipe fica desligado pelo dono (reversível em Config)',
    async () => {
      const id = await novoTenant()
      // Precisa estar num plano que LIBERA equipe, senão desligar não grava nada (é cadeado).
      await svc.from('tenants').update({ plan: 'avancado' }).eq('id', id)
      const r = await gravarRespostaDePerfil(svc, id, { acao: 'responder', tamanho: 'so_eu' }, 'owner')
      expect(r.efeitos).toContain('team:desligado')
      expect(await desligados(id)).toContain('team')
    },
    60_000,
  )

  it(
    '"Eu e mais gente" não liga nem libera nada — a resposta nunca vira atalho de plano',
    async () => {
      const id = await novoTenant()
      const modulosAntes = (await svc.from('tenant_modules').select('modulo, ligado').eq('tenant_id', id)).data
      const r = await gravarRespostaDePerfil(svc, id, { acao: 'responder', tamanho: 'com_equipe' }, 'owner')
      expect(r.efeitos).toEqual([])
      expect((await svc.from('tenant_modules').select('modulo, ligado').eq('tenant_id', id)).data).toEqual(modulosAntes)
    },
    60_000,
  )

  it(
    'sem tenant:update (recepção), a resposta é registrada mas NÃO muda o painel',
    async () => {
      const id = await novoTenant()
      await svc.from('tenants').update({ plan: 'avancado' }).eq('id', id)
      const r = await gravarRespostaDePerfil(svc, id, { acao: 'responder', tamanho: 'so_eu', dor: 'cliente_some' }, 'reception')
      expect(r.efeitos).toEqual([])
      expect(await desligados(id)).not.toContain('team')
      expect((await settingsDe(id)).dor_principal).toBeUndefined()
      const { data: eventos } = await svc.from('product_events').select('meta').eq('tenant_id', id).eq('event_type', 'perfil_respondido')
      expect(eventos?.[0]?.meta).toEqual({ tamanho: 'so_eu', dor: 'cliente_some' })
    },
    60_000,
  )
})
