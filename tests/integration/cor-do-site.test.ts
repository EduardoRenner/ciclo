import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { perfilPublico } from '@/server/services/public-booking'
import { atualizarTenant } from '@/server/services/site'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de cor do site precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const OSSO = '#f0ebe3'
const tenants: string[] = []
const usuarios: string[] = []

async function criarTenant(vertical: Database['public']['Enums']['vertical_pack'], nome: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `cor-site-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const slug = `cor-site-${marca}`
  const { tenant } = await executarOnboarding(svc, { userId: data.user.id, businessName: nome, vertical, slug, timezone: 'America/Sao_Paulo' })
  tenants.push(tenant.id)
  return { tenantId: tenant.id, slug }
}

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

/**
 * docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T3 + testes 5 e 6 de §8). Antes desta
 * migration, `lashes` e `brows` recebiam roxo (`#a855f7`/`#8b5cf6`) fixo por
 * `vertical_packs.accent_color` — a origem real do "layout roxo" no site de
 * salões dessas duas profissões. Prova, contra o banco de verdade (não um
 * mock), que isso não existe mais e que a cor de um tenant nunca aparece no
 * de outro.
 */
describe('cor do site público — fonte única e isolamento entre tenants', () => {
  it(
    'tenant de vertical historicamente roxa (lashes/brows) nasce osso, não roxo',
    async () => {
      const { slug: slugCilios } = await criarTenant('lashes', 'Salão de Cílios')
      const { slug: slugSobrancelhas } = await criarTenant('brows', 'Salão de Sobrancelha')

      const perfilCilios = await perfilPublico(slugCilios)
      const perfilSobrancelhas = await perfilPublico(slugSobrancelhas)

      expect(perfilCilios.accentColor.acc).toBe(OSSO)
      expect(perfilSobrancelhas.accentColor.acc).toBe(OSSO)
      expect(perfilCilios.accentColor.acc).not.toMatch(/^#a855f7$/i)
      expect(perfilSobrancelhas.accentColor.acc).not.toMatch(/^#8b5cf6$/i)
    },
    30_000,
  )

  it(
    'dono escolhe a cor do próprio site, e ela não vaza para outro tenant',
    async () => {
      const { tenantId: idA, slug: slugA } = await criarTenant('barber', 'Barbearia A')
      const { slug: slugB } = await criarTenant('barber', 'Barbearia B')

      await atualizarTenant(svc, idA, { site: { accent: '#2563eb' } })

      const perfilA = await perfilPublico(slugA)
      const perfilB = await perfilPublico(slugB)

      expect(perfilA.accentColor.acc).toBe('#2563eb')
      // Mesma vertical, mesmo instante — a cor de A não vaza para B nem por
      // acaso, nem por chave de cache mal escopada.
      expect(perfilB.accentColor.acc).toBe(OSSO)
    },
    30_000,
  )

  it(
    'cor inválida gravada diretamente no banco (contornando a API) nunca chega como style inline — cai em osso',
    async () => {
      // Simula dado sujo/legado que a validação da API nunca deixaria passar,
      // mas que pode existir por causa de uma migration antiga ou edição
      // manual — a defesa tem que estar também na leitura, não só na escrita.
      const { tenantId, slug } = await criarTenant('barber', 'Barbearia com Settings Corrompido')
      await svc.from('tenants').update({ settings: { site: { accent: 'javascript:alert(1)' } } }).eq('id', tenantId)

      const perfil = await perfilPublico(slug)
      expect(perfil.accentColor.acc).toBe(OSSO)
    },
    30_000,
  )
})
