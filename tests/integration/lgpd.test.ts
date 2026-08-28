import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { registrarConsentimento } from '@/server/services/consentimentos'
import { eliminarCliente, exportarDadosDoCliente } from '@/server/services/lgpd'
import { fazerUploadMedia } from '@/server/services/media-upload'
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
  const cliente = await svc
    .from('clients')
    .insert({
      tenant_id: tenantId,
      name: nome,
      phone_e164: telefone,
      // As colunas das migrations 0017/0019 que a eliminação deixava para trás até a auditoria
      // de 2026-08-23 (achado S15). Preenchidas de propósito: sem valor aqui, o teste passaria
      // com a função antiga, que é exatamente como o defeito sobreviveu por tanto tempo.
      document: '123.456.789-09',
      gender: 'feminino',
      address: 'Rua das Acácias, 100',
      emergency_contact: 'Irmã — (11) 98888-7777',
      preferences: { alergia: 'cianoacrilato', curvatura: 'D' },
    })
    .select('id')
    .single()
  if (cliente.error) throw cliente.error
  const clientId = cliente.data!.id

  await salvarRespostas(svc, tenantId, clientId, { formKey: 'lashes_v1', answers: { pregnant: false } })
  await registrarConsentimento(
    svc,
    tenantId,
    clientId,
    { kind: 'image_use', version: '1.0', text: 'autorizo', granted: true },
    // Com valor, para provar a redação: o consentimento sobrevive (prova de que houve permissão),
    // o rastro de quem clicou não.
    { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (iPhone)' },
  )
  const media = await fazerUploadMedia(tenantId, { clientId, appointmentId: null, phase: 'before' }, { buffer: await imagemPequena(), createdBy: null })

  const nota = await svc.from('client_notes').insert({ tenant_id: tenantId, client_id: clientId, body: 'Gostou do volume russo.' }).select('id').single()
  if (nota.error) throw nota.error

  // `waitlist` exige serviço; o pacote da vertical semeado pelo onboarding já deixou alguns.
  const servico = await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle()
  if (servico.error) throw servico.error
  if (servico.data) {
    const fila = await svc.from('waitlist').insert({ tenant_id: tenantId, client_id: clientId, service_id: servico.data.id, period_of_day: 'morning' }).select('id').single()
    if (fila.error) throw fila.error
  }

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
      expect(resultado.anonymized).toBe(true)
      expect(resultado.healthRecordsRemoved).toBe(1)
      expect(resultado.mediaRemoved).toBe(1)
      expect(resultado.rowsRemoved.client_notes).toBe(1)

      const saude = await svc.from('health_records').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).maybeSingle()
      expect(saude.data).toBeNull()

      const media = await svc.from('media').select('id').eq('id', mediaId).maybeSingle()
      expect(media.data).toBeNull()

      const { data: listaStorage } = await svc.storage.from('media').list(tenantId)
      expect(listaStorage?.some((f) => storageKey.endsWith(f.name))).toBe(false)

      const cliente = await svc
        .from('clients')
        .select('name, phone_e164, email, document, gender, address, emergency_contact, preferences, anonymized_at, deleted_at')
        .eq('id', clientId)
        .single()
      expect(cliente.data?.name).toBe('Cliente eliminada')
      expect(cliente.data?.phone_e164).toBeNull()
      expect(cliente.data?.anonymized_at).not.toBeNull()

      // Achado S15: estas cinco sobreviviam à eliminação enquanto o sistema respondia
      // `anonymized: true` e a tela dizia "Cliente eliminada".
      expect(cliente.data?.document).toBeNull()
      expect(cliente.data?.gender).toBeNull()
      expect(cliente.data?.address).toBeNull()
      expect(cliente.data?.emergency_contact).toBeNull()
      expect(cliente.data?.preferences).toEqual({}) // carregava "alergia"

      const notas = await svc.from('client_notes').select('id').eq('client_id', clientId)
      expect(notas.data ?? []).toHaveLength(0)

      const fila = await svc.from('waitlist').select('id').eq('client_id', clientId)
      expect(fila.data ?? []).toHaveLength(0)

      // O consentimento sobrevive (art. 16, III: prova de que houve permissão); o rastro pessoal não.
      const consentimento = await svc.from('consents').select('granted, version, ip, user_agent').eq('client_id', clientId).maybeSingle()
      expect(consentimento.data?.granted).toBe(true)
      expect(consentimento.data?.version).toBe('1.0')
      expect(consentimento.data?.ip).toBeNull()
      expect(consentimento.data?.user_agent).toBeNull()
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


/**
 * Achado de 2026-08-28 — o ponto cego do `jsonb`.
 *
 * `audit_log` e `idempotency_keys` guardam a linha inteira da cliente dentro de um `jsonb` e não
 * referenciam `clients`. Nem o detector do teste de cobertura (que procura FK + coluna textual)
 * nem `eliminarCliente` chegavam nelas: o sistema respondia `anonymized: true` com CPF, endereço
 * e contato de emergência de um terceiro intactos, a uma consulta de distância — e legíveis para
 * `owner`, `manager` e `finance`, que é quem a política `audit_read` deixa ler.
 */
describe('a eliminação alcança a trilha e a chave de idempotência', () => {
  it(
    'CPF, endereço e contato de emergência não sobrevivem em audit_log nem em idempotency_keys',
    async () => {
      const { clientId } = await clienteCompleto('Trilha da Maria')

      // A trilha como ela nasce na rota: `after` é a linha da cliente, inteira.
      const { data: linha } = await svc.from('clients').select('*').eq('id', clientId).single()
      const trilha = await svc
        .from('audit_log')
        .insert({ tenant_id: tenantId, action: 'client.create', entity: 'clients', entity_id: clientId, after: linha as never, request_id: 'teste' })
        .select('id')
        .single()
      if (trilha.error) throw trilha.error

      const chave = `${tenantId}:${randomUUID()}`
      const idem = await svc
        .from('idempotency_keys')
        .insert({ key: chave, tenant_id: tenantId, endpoint: '/api/v1/clients', request_hash: 'x', response_status: 200, response_body: linha as never })
        .select('key')
        .single()
      if (idem.error) throw idem.error

      // Sanidade: sem isto, o teste passaria por o dado nunca ter chegado lá.
      const antes = await svc.from('audit_log').select('after').eq('id', trilha.data!.id).single()
      expect(JSON.stringify(antes.data!.after), 'o CPF não chegou à trilha — o cenário não foi montado').toContain('123.456.789-09')

      await eliminarCliente(svc, tenantId, clientId)

      const depoisTrilha = await svc.from('audit_log').select('id, action, entity_id, before, after').eq('id', trilha.data!.id).single()
      expect(depoisTrilha.data, 'a LINHA da trilha some — regra 11 diz que registro de auditoria nunca é apagado').not.toBeNull()
      expect(depoisTrilha.data!.action, 'a trilha perdeu o que ela existe para guardar').toBe('client.create')
      expect(depoisTrilha.data!.after, 'o corpo da trilha ainda carrega a cliente eliminada').toBeNull()
      expect(depoisTrilha.data!.before).toBeNull()

      const depoisChave = await svc.from('idempotency_keys').select('key, response_body').eq('key', chave).single()
      expect(depoisChave.data, 'a chave sumiu — uma repetição da fila offline reexecutaria a mutação').not.toBeNull()
      expect(JSON.stringify(depoisChave.data!.response_body), 'o corpo guardado ainda tem o CPF').not.toContain('123.456.789-09')
    },
    60_000,
  )

  it(
    'a RPC recusa redigir a trilha de uma cliente ATIVA',
    async () => {
      const { clientId } = await clienteCompleto('Ativa da Silva')
      const r = await svc.rpc('redigir_trilha_do_cliente', { p_tenant: tenantId, p_client: clientId })
      expect(r.error, 'a RPC aceitou redigir a trilha de quem não foi eliminada').not.toBeNull()
    },
    60_000,
  )
})
