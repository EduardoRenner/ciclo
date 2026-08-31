import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { registrarConsentimento, revogarConsentimento } from '@/server/services/consentimentos'
import { deletarMedia, listarMediaDoCliente } from '@/server/services/media'
import { fazerUploadMedia } from '@/server/services/media-upload'
import { executarOnboarding } from '@/server/services/onboarding'
import { despublicarDoPortfolio } from '@/server/services/portfolio'
import { publicarNoPortfolio } from '@/server/services/portfolio-upload'
import { perfilPublico } from '@/server/services/public-booking'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de portfolio precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let slug: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

async function imagemPequena(): Promise<Buffer> {
  return sharp({ create: { width: 12, height: 12, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer()
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `portfolio-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Portfólio' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  slug = `portfolio-${marca}`
  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Portfólio',
    vertical: 'nails',
    slug,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Portfólio' }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
})

describe('publicarNoPortfolio (TICKET-115)', () => {
  it(
    'sem consentimento image_use ativo: recusa com erro de validação, nada sobe',
    async () => {
      const media = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'after' }, { buffer: await imagemPequena(), createdBy: null })
      await expect(publicarNoPortfolio(tenantId, media.id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })

      const linha = await svc.from('portfolio_photos').select('id').eq('tenant_id', tenantId).eq('source_media_id', media.id).maybeSingle()
      expect(linha.data).toBeNull()
    },
    30_000,
  )

  it(
    'com consentimento ativo: publica, aparece em perfilPublico, e some da listagem quando despublicada',
    async () => {
      const consentimento = await registrarConsentimento(svc, tenantId, clientId, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })
      const media = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'after', consentId: consentimento.id }, { buffer: await imagemPequena(), createdBy: null })

      const publicada = await publicarNoPortfolio(tenantId, media.id)
      expect(publicada.url).toContain('/vitrine/')

      const perfil = await perfilPublico(slug)
      expect(perfil.portfolio).toContain(publicada.url)

      const fotos = await listarMediaDoCliente(tenantId, clientId)
      expect(fotos.find((f) => f.id === media.id)?.publicada).toBe(true)

      await despublicarDoPortfolio(tenantId, media.id)

      const perfilDepois = await perfilPublico(slug)
      expect(perfilDepois.portfolio).not.toContain(publicada.url)

      const fotosDepois = await listarMediaDoCliente(tenantId, clientId)
      expect(fotosDepois.find((f) => f.id === media.id)?.publicada).toBe(false)
    },
    30_000,
  )

  it(
    'publicar de novo a mesma foto substitui a cópia anterior — nunca duplica linha',
    async () => {
      const consentimento = await registrarConsentimento(svc, tenantId, clientId, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })
      const media = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'before', consentId: consentimento.id }, { buffer: await imagemPequena(), createdBy: null })

      const primeira = await publicarNoPortfolio(tenantId, media.id)
      const segunda = await publicarNoPortfolio(tenantId, media.id)
      expect(segunda.url).not.toBe(primeira.url) // arquivo novo, chave nova

      const linhas = await svc.from('portfolio_photos').select('id').eq('tenant_id', tenantId).eq('source_media_id', media.id)
      expect(linhas.data).toHaveLength(1)
    },
    30_000,
  )

  it(
    'revogar image_use tira TODAS as fotos publicadas daquela cliente do site imediatamente',
    async () => {
      const consentimento = await registrarConsentimento(svc, tenantId, clientId, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })
      const mediaA = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'before', consentId: consentimento.id }, { buffer: await imagemPequena(), createdBy: null })
      const mediaB = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'after', consentId: consentimento.id }, { buffer: await imagemPequena(), createdBy: null })
      await publicarNoPortfolio(tenantId, mediaA.id)
      await publicarNoPortfolio(tenantId, mediaB.id)

      const antes = await perfilPublico(slug)
      expect(antes.portfolio.length).toBeGreaterThanOrEqual(2)

      await revogarConsentimento(svc, tenantId, clientId, 'image_use')

      const depois = await perfilPublico(slug)
      expect(depois.portfolio.length).toBe(0)

      const linhas = await svc.from('portfolio_photos').select('id').eq('tenant_id', tenantId).eq('client_id', clientId)
      expect(linhas.data ?? []).toHaveLength(0)
    },
    30_000,
  )

  it(
    'apagar a foto original (soft delete) tira a cópia publicada do site',
    async () => {
      const consentimento = await registrarConsentimento(svc, tenantId, clientId, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })
      const media = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'reference', consentId: consentimento.id }, { buffer: await imagemPequena(), createdBy: null })
      await publicarNoPortfolio(tenantId, media.id)

      const antes = await perfilPublico(slug)
      expect(antes.portfolio.length).toBeGreaterThan(0)

      await deletarMedia(tenantId, media.id)

      const depois = await perfilPublico(slug)
      expect(depois.portfolio.length).toBe(0)
    },
    30_000,
  )

  it(
    'token de outro tenant / mediaId inexistente devolve NOT_FOUND',
    async () => {
      await expect(publicarNoPortfolio(tenantId, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})
