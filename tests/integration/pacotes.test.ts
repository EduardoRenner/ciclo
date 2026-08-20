import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { consumirSessao, creditarCarteira, debitarCarteira, listarPacotesDoCliente, pacotesAVencerEmBreve, saldoCarteira, venderPacote } from '@/server/services/pacotes'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de pacotes precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let servicoId: string
let clientId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `pacotes-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona dos Pacotes' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão dos Pacotes',
    vertical: 'nails',
    slug: `pacotes-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const servico = await criarServico(svc, tenantId, {
    name: 'Sessão de Teste',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 8_000,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoId = servico.id

  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente dos Pacotes' }).select('id').single()
  clientId = cliente.data!.id
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('venderPacote / consumirSessao', () => {
  it(
    'consumir sessão baixa o saldo até esgotar',
    async () => {
      const pacote = await venderPacote(svc, tenantId, { clientId, serviceId: servicoId, totalSessions: 2, paidCents: 15_000 })

      const primeira = await consumirSessao(svc, tenantId, pacote.id)
      expect(primeira.remainingSessions).toBe(1)

      const segunda = await consumirSessao(svc, tenantId, pacote.id)
      expect(segunda.remainingSessions).toBe(0)

      await expect(consumirSessao(svc, tenantId, pacote.id)).rejects.toThrow()
    },
    30_000,
  )

  it(
    'duas requisições concorrentes pelo mesmo pacote: só uma consome a última sessão',
    async () => {
      const pacote = await venderPacote(svc, tenantId, { clientId, serviceId: servicoId, totalSessions: 1, paidCents: 8_000 })

      const resultados = await Promise.allSettled([consumirSessao(svc, tenantId, pacote.id), consumirSessao(svc, tenantId, pacote.id)])
      const sucessos = resultados.filter((r) => r.status === 'fulfilled')
      const falhas = resultados.filter((r) => r.status === 'rejected')

      expect(sucessos).toHaveLength(1)
      expect(falhas).toHaveLength(1)

      const { count } = await svc.from('package_uses').select('*', { count: 'exact', head: true }).eq('package_id', pacote.id)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'listarPacotesDoCliente calcula dias até o vencimento e sinaliza expiringSoon',
    async () => {
      const hoje = '2026-03-01'
      const daqui10Dias = '2026-03-11'
      await venderPacote(svc, tenantId, { clientId, serviceId: servicoId, totalSessions: 3, paidCents: 20_000, expiresOn: daqui10Dias })

      const pacotes = await listarPacotesDoCliente(svc, tenantId, clientId, hoje)
      const criado = pacotes.find((p) => p.expiresOn === daqui10Dias)
      expect(criado?.daysUntilExpiry).toBe(10)
      expect(criado?.expiringSoon).toBe(true)
    },
    30_000,
  )

  it(
    'pacotesAVencerEmBreve não lista pacote já totalmente usado, mesmo vencendo em breve',
    async () => {
      const hoje = '2026-03-01'
      const pacote = await venderPacote(svc, tenantId, { clientId, serviceId: servicoId, totalSessions: 1, paidCents: 8_000, expiresOn: '2026-03-05' })
      await consumirSessao(svc, tenantId, pacote.id)

      const aVencer = await pacotesAVencerEmBreve(svc, tenantId, hoje)
      expect(aVencer.some((p) => p.id === pacote.id)).toBe(false)
    },
    30_000,
  )
})

describe('carteira', () => {
  it(
    'creditar e debitar movem o saldo corretamente',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente da Carteira' }).select('id').single()
      const id = outroCliente.data!.id

      await creditarCarteira(svc, tenantId, { clientId: id, amountCents: 3_000, reason: 'Sinal virou crédito' })
      const saldoAposCredito = await debitarCarteira(svc, tenantId, { clientId: id, amountCents: 1_000, reason: 'Abatido na comanda' })
      expect(saldoAposCredito).toBe(2_000)

      expect(await saldoCarteira(svc, tenantId, id)).toBe(2_000)
    },
    30_000,
  )

  it(
    'debitar mais do que o saldo é recusado, sem deixar a cliente devendo',
    async () => {
      const outroCliente = await svc.from('clients').insert({ tenant_id: tenantId, name: 'Cliente Sem Saldo' }).select('id').single()
      const id = outroCliente.data!.id

      await expect(debitarCarteira(svc, tenantId, { clientId: id, amountCents: 500, reason: 'Tentativa sem saldo' })).rejects.toThrow()
    },
    30_000,
  )
})
