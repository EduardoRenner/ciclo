import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { abrirFicha, alertaDoCliente, formularioDoTenant, salvarRespostas } from '@/server/services/anamnese'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de anamnese precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `anamnese-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Anamnese' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  // 'lashes' tem formulário com perguntas alert_if=true (eye_surgery, glue_allergy).
  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Anamnese',
    vertical: 'lashes',
    slug: `anamnese-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente da Anamnese' }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('formularioDoTenant', () => {
  it(
    'devolve o formulário do pack da vertical do tenant',
    async () => {
      const formulario = await formularioDoTenant(svc, tenantId)
      expect(formulario.key).toBe('lashes_v1')
      expect(formulario.questions.some((q) => q.id === 'glue_allergy')).toBe(true)
    },
    30_000,
  )
})

describe('salvarRespostas / abrirFicha', () => {
  it(
    'resposta sem gatilho: sem alerta, ficha abre com as respostas certas',
    async () => {
      const resultado = await salvarRespostas(svc, tenantId, clientId, {
        formKey: 'lashes_v1',
        answers: { pregnant: false, eye_surgery: false, glue_allergy: false },
      })
      expect(resultado.hasAlert).toBe(false)

      const ficha = await abrirFicha(svc, tenantId, clientId, { actorId: null, ip: '203.0.113.9', userAgent: 'vitest' })
      expect(ficha?.hasAlert).toBe(false)
      expect(ficha?.answers).toEqual({ pregnant: false, eye_surgery: false, glue_allergy: false })
    },
    30_000,
  )

  it(
    'resposta com gatilho: has_alert fica em claro no banco, sem abrir o cofre',
    async () => {
      await salvarRespostas(svc, tenantId, clientId, {
        formKey: 'lashes_v1',
        answers: { glue_allergy: true },
      })

      // Leitura leve, sem decifrar — é o que o card do "próximo atendimento" usa.
      const alerta = await alertaDoCliente(svc, tenantId, clientId)
      expect(alerta.hasAlert).toBe(true)
      expect(alerta.alertLabel).toBe('Atenção')

      // O rótulo em claro nunca é a pergunta clínica.
      expect(alerta.alertLabel).not.toContain('cola')
    },
    30_000,
  )

  it(
    'preencher de novo o mesmo formulário atualiza a linha, não duplica (índice único)',
    async () => {
      await salvarRespostas(svc, tenantId, clientId, { formKey: 'lashes_v1', answers: { glue_allergy: false } })
      await salvarRespostas(svc, tenantId, clientId, { formKey: 'lashes_v1', answers: { glue_allergy: true } })

      const { count } = await svc
        .from('health_records')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'abrir a ficha grava em vault_access_log',
    async () => {
      const antes = await svc
        .from('vault_access_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)

      await abrirFicha(svc, tenantId, clientId, { actorId: null, ip: '203.0.113.9', userAgent: 'vitest' })

      const depois = await svc
        .from('vault_access_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
      expect(depois.count).toBe((antes.count ?? 0) + 1)
    },
    30_000,
  )

  it(
    'cliente sem anamnese: abrirFicha devolve null, mas ainda registra a tentativa de acesso',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Sem Anamnese' }).select('id').single()

      const ficha = await abrirFicha(svc, tenantId, outroCliente.data!.id, { actorId: null, ip: null, userAgent: null })
      expect(ficha).toBeNull()

      const log = await svc
        .from('vault_access_log')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', outroCliente.data!.id)
      expect(log.count).toBe(1)
    },
    30_000,
  )

  it(
    'formKey diferente do formulário vigente é recusado',
    async () => {
      await expect(salvarRespostas(svc, tenantId, clientId, { formKey: 'outro_formulario', answers: {} })).rejects.toThrow()
    },
    30_000,
  )
})
