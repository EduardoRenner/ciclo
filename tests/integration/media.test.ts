import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { registrarConsentimento, revogarConsentimento } from '@/server/services/consentimentos'
import { deletarMedia, listarMediaDoCliente, mediaParaPortfolio, urlAssinadaMedia } from '@/server/services/media'
import { fazerUploadMedia } from '@/server/services/media-upload'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de media precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

async function pngComExif(): Promise<Buffer> {
  return sharp({ create: { width: 20, height: 20, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .withMetadata({ exif: { IFD0: { Make: 'CameraFabricante', Model: 'ModeloDaCamera' } } })
    .jpeg()
    .toBuffer()
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `media-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Media' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Media',
    vertical: 'nails',
    slug: `media-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente da Media' }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('fazerUploadMedia', () => {
  it(
    'remove o EXIF da imagem original e grava storage_key aleatório',
    async () => {
      const original = await pngComExif()
      const registro = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'before' }, { buffer: original, createdBy: null })

      expect(registro.storage_key).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]{36}\\.webp$`))
      expect(registro.storage_key).not.toContain(clientId) // nunca previsível a partir do cliente

      const { url } = await urlAssinadaMedia(tenantId, registro.id, { actorId: null, ip: null, userAgent: null })
      const baixado = Buffer.from(await (await fetch(url)).arrayBuffer())
      const metadados = await sharp(baixado).metadata()
      expect(metadados.exif).toBeUndefined()
    },
    30_000,
  )

  it(
    'aparece na listagem do cliente',
    async () => {
      const original = await pngComExif()
      await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'after' }, { buffer: original, createdBy: null })

      const lista = await listarMediaDoCliente(tenantId, clientId)
      expect(lista.some((m) => m.phase === 'after')).toBe(true)
    },
    30_000,
  )
})

describe('fazerUploadMedia com consentId (TICKET-114)', () => {
  it(
    'consentimento image_use ativo, do mesmo cliente: vincula media.consent_id',
    async () => {
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente Autorizou' }).select('id').single()
      const id = cliente.data!.id
      const consentimento = await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })

      const registro = await fazerUploadMedia(tenantId, { clientId: id, appointmentId: null, phase: 'before', consentId: consentimento.id }, { buffer: await pngComExif(), createdBy: null })

      const linha = await svc.from('media').select('consent_id').eq('id', registro.id).single()
      expect(linha.data?.consent_id).toBe(consentimento.id)
    },
    30_000,
  )

  it(
    'consentId de OUTRO cliente é ignorado — nunca vincula foto a consentimento alheio',
    async () => {
      const donaDoConsentimento = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Dona do Consentimento' }).select('id').single()
      const outraCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Outra Cliente' }).select('id').single()
      const consentimento = await registrarConsentimento(
        svc,
        tenantId,
        donaDoConsentimento.data!.id,
        { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true },
        { ip: null, userAgent: null },
      )

      const registro = await fazerUploadMedia(
        tenantId,
        { clientId: outraCliente.data!.id, appointmentId: null, phase: 'before', consentId: consentimento.id },
        { buffer: await pngComExif(), createdBy: null },
      )

      const linha = await svc.from('media').select('consent_id').eq('id', registro.id).single()
      expect(linha.data?.consent_id).toBeNull()
    },
    30_000,
  )

  it(
    'consentId revogado é ignorado — foto sobe sem vínculo, não vira erro',
    async () => {
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente Revogou Antes' }).select('id').single()
      const id = cliente.data!.id
      const consentimento = await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })
      await revogarConsentimento(svc, tenantId, id, 'image_use')

      const registro = await fazerUploadMedia(tenantId, { clientId: id, appointmentId: null, phase: 'before', consentId: consentimento.id }, { buffer: await pngComExif(), createdBy: null })

      const linha = await svc.from('media').select('consent_id').eq('id', registro.id).single()
      expect(linha.data?.consent_id).toBeNull()
    },
    30_000,
  )
})

describe('deletarMedia', () => {
  it(
    'some da listagem (soft delete) sem apagar o arquivo do bucket',
    async () => {
      const registro = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'reference' }, { buffer: await pngComExif(), createdBy: null })

      await deletarMedia(tenantId, registro.id)

      const lista = await listarMediaDoCliente(tenantId, clientId)
      expect(lista.some((m) => m.id === registro.id)).toBe(false)

      const linha = await svc.from('media').select('deleted_at, storage_key').eq('id', registro.id).single()
      expect(linha.data?.deleted_at).not.toBeNull()

      const { data: arquivo } = await svc.storage.from('media').list(tenantId, { search: linha.data!.storage_key.split('/')[1] })
      expect(arquivo?.length ?? 0).toBeGreaterThan(0)
    },
    30_000,
  )

  it(
    'apagar de novo uma foto já apagada não lança erro (idempotente)',
    async () => {
      const registro = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'reference' }, { buffer: await pngComExif(), createdBy: null })
      await deletarMedia(tenantId, registro.id)
      await expect(deletarMedia(tenantId, registro.id)).resolves.toBeUndefined()
    },
    30_000,
  )
})

describe('urlAssinadaMedia', () => {
  it(
    'cada geração de URL grava em vault_access_log',
    async () => {
      const registro = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'reference' }, { buffer: await pngComExif(), createdBy: null })

      const antes = await svc.from('vault_access_log').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)
      await urlAssinadaMedia(tenantId, registro.id, { actorId: null, ip: '203.0.113.7', userAgent: 'vitest' })
      const depois = await svc.from('vault_access_log').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)

      expect(depois.count).toBe((antes.count ?? 0) + 1)
    },
    30_000,
  )
})

describe('mediaParaPortfolio', () => {
  it(
    'revogar image_use esconde a foto do portfólio imediatamente',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Portfólio' }).select('id').single()
      const id = outroCliente.data!.id

      const consentimento = await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })

      const registro = await fazerUploadMedia(tenantId, { clientId: id, appointmentId: null, phase: 'after' }, { buffer: await pngComExif(), createdBy: null })
      await svc.from('media').update({ consent_id: consentimento.id }).eq('id', registro.id)

      const antesDeRevogar = await mediaParaPortfolio(tenantId, id)
      expect(antesDeRevogar.some((m) => m.id === registro.id)).toBe(true)

      await revogarConsentimento(svc, tenantId, id, 'image_use')

      const depoisDeRevogar = await mediaParaPortfolio(tenantId, id)
      expect(depoisDeRevogar.some((m) => m.id === registro.id)).toBe(false)
    },
    30_000,
  )

  it(
    'foto sem consent_id (uso clínico interno) nunca aparece no portfólio',
    async () => {
      const registro = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'before' }, { buffer: await pngComExif(), createdBy: null })

      const portfolio = await mediaParaPortfolio(tenantId, clientId)
      expect(portfolio.some((m) => m.id === registro.id)).toBe(false)
    },
    30_000,
  )
})
