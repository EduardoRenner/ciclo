import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { definirExpediente } from '@/server/services/expediente'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { buscarNegocios } from '@/server/services/busca-publica'
import { atualizarTenant, lerTenant } from '@/server/services/site'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('A busca pública precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
  docs/114 L-06: a busca da cliente. A cidade de cada rodada é única (`Cidade{marca}`), para a busca
  achar só os negócios deste arquivo no banco local compartilhado.
*/
const marca = randomUUID().slice(0, 8)
const CIDADE = `Cidade${marca}`
const tenants: string[] = []
const usuarios: string[] = []
const slugs: Record<'visivel' | 'escondido', string> = { visivel: '', escondido: '' }

async function negocio(chave: 'visivel' | 'escondido') {
  const { data, error } = await svc.auth.admin.createUser({
    email: `busca-${chave}-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Busca' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  slugs[chave] = `busca-${chave}-${marca}`
  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: chave === 'visivel' ? 'Studio da Busca Visível' : 'Studio da Busca Escondido',
    vertical: 'brows',
    slug: slugs[chave],
    timezone: 'America/Sao_Paulo',
  })
  tenants.push(tenant.id)
  const settings = chave === 'escondido' ? { search_visible: false } : {}
  await svc.from('tenants').update({ address: `Rua das Flores, 10, Centro, ${CIDADE} - SC`, settings }).eq('id', tenant.id)

  const profissional = await criarProfissional(svc, tenant.id, { displayName: 'Quem Atende', compModel: 'owner', commissionBps: 0, rentCents: 0, acceptsOnline: true })
  await criarServico(svc, tenant.id, {
    name: 'Design de sobrancelha da busca',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 6500,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  await definirExpediente(svc, tenant.id, { professionalId: profissional.id, blocos: [{ weekday: 2, opensAt: '09:00', closesAt: '18:00' }] })
}

beforeAll(async () => {
  await negocio('visivel')
  await negocio('escondido')
}, 90_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('buscarNegocios (L-06)', () => {
  it('acha pelo serviço e pela cidade, com o "a partir de" e o link do negócio', async () => {
    const resultados = await buscarNegocios({ termo: 'sobrancelha', cidade: CIDADE })
    expect(resultados.map((r) => r.slug)).toEqual([slugs.visivel])
    expect(resultados[0]).toMatchObject({ nome: 'Studio da Busca Visível', servico: 'Design de sobrancelha da busca', aPartirDeCents: 6500 })
  }, 30_000)

  it('quem desligou "aparecer na busca" não aparece; controle: o mesmo negócio existe e tem serviço', async () => {
    const { data } = await svc.from('tenants').select('slug').eq('slug', slugs.escondido).single()
    expect(data?.slug).toBe(slugs.escondido)
    expect((await buscarNegocios({ termo: '', cidade: CIDADE })).map((r) => r.slug)).not.toContain(slugs.escondido)
  }, 30_000)

  it('serviço que ninguém faz na cidade não acha nada', async () => {
    expect(await buscarNegocios({ termo: 'barba', cidade: CIDADE })).toEqual([])
  }, 30_000)
  it('a chave da tela de Negócio tira e põe de volta na busca, e a tela lê o mesmo valor', async () => {
    const { data } = await svc.from('tenants').select('id').eq('slug', slugs.visivel).single()
    const id = data!.id
    try {
      await atualizarTenant(svc, id, { aparecerNaBusca: false })
      expect((await lerTenant(svc, id)).aparecerNaBusca).toBe(false)
      expect((await buscarNegocios({ termo: '', cidade: CIDADE })).map((r) => r.slug)).not.toContain(slugs.visivel)
    } finally {
      await atualizarTenant(svc, id, { aparecerNaBusca: true })
    }
    expect((await lerTenant(svc, id)).aparecerNaBusca).toBe(true)
    expect((await buscarNegocios({ termo: '', cidade: CIDADE })).map((r) => r.slug)).toContain(slugs.visivel)
  }, 30_000)
})
