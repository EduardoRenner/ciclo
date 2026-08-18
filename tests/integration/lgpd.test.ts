import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { registrarConsentimento } from '@/server/services/consentimentos'
import { eliminarCliente, exportarDadosDoCliente } from '@/server/services/lgpd'
import { fazerUploadMedia } from '@/server/services/media'
import { executarOnboarding } from '@/server/services/onboarding'
import { salvarRespostas } from '@/server/services/anamnese'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de lgpd precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

async function imagemPequena(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } }).jpeg().toBuffer()
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `lgpd-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do LGPD' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do LGPD',
    vertical: 'lashes',
    slug: `lgpd-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

let contadorTelefone = 0

async function clienteCompleto(nome: string) {
  contadorTelefone++
  // Telefone único por cliente: `clients_unique_phone` (tenant_id, phone_e164) rejeitaria o
  // segundo insert com o mesmo número em silêncio (erro ignorado por `.data!`).
  const telefone = `+551197777${String(contadorTelefone).padStart(4, '0')}`
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: nome, phone_e164: telefone }).select('id').single()
  if (cliente.error) throw cliente.error
  const clientId = cliente.data!.id

  await salvarRespostas(svc, tenantId, clientId, { formKey: 'lashes_v1', answers: { pregnant: false } })
  await registrarConsentimento(svc, tenantId, clientId, { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true }, { ip: null, userAgent: null })
  const media = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'before' }, { buffer: await imagemPequena(), createdBy: null })

  return { clientId, mediaId: media.id, storageKey: media.storage_key }
}

describe('exportarDadosDoCliente', () => {
  it(
    'devolve a resposta da anamnese decifrada, consentimentos e mídia',
    async () => {
      const { clientId } = await clienteCompleto('Exportação Completa')

      const exportacao = await exportarDadosDoCliente(svc, tenantId, clientId, { actorId: null, ip: null, userAgent: null })

      expect(exportacao.healthRecord?.answers).toEqual({ pregnant: false })
      expect(exportacao.consents).toHaveLength(1)
      expect(exportacao.media).toHaveLength(1)
      expect((exportacao.client as { name: string }).name).toBe('Exportação Completa')
    },
    30_000,
  )
})

describe('eliminarCliente', () => {
  it(
    'apaga o cofre e a mídia de verdade, anonimiza o cadastro',
    async () => {
      const { clientId, mediaId, storageKey } = await clienteCompleto('Para Eliminar')

      const resultado = await eliminarCliente(svc, tenantId, clientId)
      expect(resultado).toEqual({ anonymized: true, healthRecordsRemoved: 1, mediaRemoved: 1 })

      const saude = await svc.from('health_records').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).maybeSingle()
      expect(saude.data).toBeNull()

      const media = await svc.from('media').select('id').eq('id', mediaId).maybeSingle()
      expect(media.data).toBeNull()

      const { data: listaStorage } = await svc.storage.from('media').list(tenantId)
      expect(listaStorage?.some((f) => storageKey.endsWith(f.name))).toBe(false)

      const cliente = await svc.from('clients').select('name, phone_e164, email, anonymized_at, deleted_at').eq('id', clientId).single()
      expect(cliente.data?.name).toBe('Cliente eliminada')
      expect(cliente.data?.phone_e164).toBeNull()
      expect(cliente.data?.anonymized_at).not.toBeNull()
    },
    30_000,
  )

  it(
    'eliminar duas vezes a mesma cliente é recusado',
    async () => {
      const { clientId } = await clienteCompleto('Eliminada Duas Vezes')
      await eliminarCliente(svc, tenantId, clientId)

      await expect(eliminarCliente(svc, tenantId, clientId)).rejects.toThrow()
    },
    30_000,
  )
})
