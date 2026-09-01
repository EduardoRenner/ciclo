import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import { hashTextoConsentimento, registrarConsentimento, revogarConsentimento, statusConsentimentos } from '@/server/services/consentimentos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de consentimentos precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `consentimentos-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona dos Consentimentos' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão dos Consentimentos',
    vertical: 'nails',
    slug: `consentimentos-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente dos Consentimentos' }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('registrarConsentimento', () => {
  it(
    'grava o hash do texto, nunca o texto por extenso',
    async () => {
      const texto = 'Autorizo o uso da minha imagem em fotos de antes e depois.'
      const consentimento = await registrarConsentimento(
        svc,
        tenantId,
        clientId,
        { kind: 'image_use', version: '1.0', text: texto, granted: true },
        { ip: '203.0.113.5', userAgent: 'vitest' },
      )

      expect(consentimento.text_hash).toBe(hashTextoConsentimento(texto))
      expect(JSON.stringify(consentimento)).not.toContain('Autorizo o uso')
    },
    30_000,
  )

  it(
    'os três tipos são registros independentes — um não sobrescreve o outro',
    async () => {
      await registrarConsentimento(svc, tenantId, clientId, { kind: 'health_data', version: '1.0', text: 'texto de saúde', granted: true }, { ip: null, userAgent: null })
      await registrarConsentimento(svc, tenantId, clientId, { kind: 'marketing', version: '1.0', text: 'texto de marketing', granted: false }, { ip: null, userAgent: null })

      const status = await statusConsentimentos(svc, tenantId, clientId)
      expect(status.health_data?.granted).toBe(true)
      expect(status.marketing?.granted).toBe(false)
    },
    30_000,
  )

  it(
    'statusConsentimentos devolve o id da linha — TICKET-114 precisa dele pra vincular o upload',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente do Id' }).select('id').single()
      const id = outroCliente.data!.id

      const gravado = await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'texto', granted: true }, { ip: null, userAgent: null })

      const status = await statusConsentimentos(svc, tenantId, id)
      expect(status.image_use?.id).toBe(gravado.id)

      await revogarConsentimento(svc, tenantId, id, 'image_use')
      const depoisDeRevogar = await statusConsentimentos(svc, tenantId, id)
      // A linha continua existindo (histórico) — `id` aponta pra ela mesmo revogada; quem decide
      // que ela não serve mais pra upload é `granted && !revokedAt`, não a ausência do id.
      expect(depoisDeRevogar.image_use?.id).toBe(gravado.id)
      expect(depoisDeRevogar.image_use?.revokedAt).not.toBeNull()
    },
    30_000,
  )
})

describe('revogarConsentimento', () => {
  it(
    'revogar marca revoked_at, sem apagar ou alterar o histórico',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente a Revogar' }).select('id').single()
      const id = outroCliente.data!.id

      const concedido = await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'texto', granted: true }, { ip: null, userAgent: null })
      expect(concedido.revoked_at).toBeNull()

      const revogado = await revogarConsentimento(svc, tenantId, id, 'image_use')
      expect(revogado.id).toBe(concedido.id)
      expect(revogado.revoked_at).not.toBeNull()
      expect(revogado.granted).toBe(true) // o histórico não muda — só o revoked_at aparece
    },
    30_000,
  )

  it(
    'duas concessões ativas do mesmo tipo — revogar fecha as duas de uma vez',
    async () => {
      // `registrarConsentimento` só faz INSERT: reconfirmar deixa duas linhas ativas. Revogar
      // precisa fechar todas — antes, `maybeSingle` estourava `INTERNAL` com múltiplas linhas e a
      // revogação não acontecia.
      const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Consentiu Duas Vezes' }).select('id').single()
      const id = cliente.data!.id

      await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'a', granted: true }, { ip: null, userAgent: null })
      await registrarConsentimento(svc, tenantId, id, { kind: 'image_use', version: '1.0', text: 'b', granted: true }, { ip: null, userAgent: null })

      await revogarConsentimento(svc, tenantId, id, 'image_use')

      const ativas = await svc.from('consents').select('id').eq('client_id', id).eq('kind', 'image_use').is('revoked_at', null)
      expect(ativas.data ?? []).toHaveLength(0)
    },
    30_000,
  )

  it(
    'revogar quando não há consentimento ativo daquele tipo dá erro claro',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Nunca Consentiu' }).select('id').single()

      await expect(revogarConsentimento(svc, tenantId, outroCliente.data!.id, 'marketing')).rejects.toThrow()
    },
    30_000,
  )
})
