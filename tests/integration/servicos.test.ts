import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { executarOnboarding } from '@/server/services/onboarding'
import {
  arquivarServico,
  atualizarServico,
  criarServico,
  listarServicos,
  reordenarServicos,
} from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de serviços precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BASE = {
  name: 'Volume russo',
  durationMin: 150,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  priceCents: 22000,
  cycleDays: 21,
  depositBps: 0,
  depositMinCents: 0,
  parallelCapacity: 1,
  requiresAnamnesis: false,
  bookableOnline: true,
}

let tenantId: string
let userId: string
let outroTenantId: string
let outroUserId: string

async function criarConta(sufixo: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `servicos-${sufixo}-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: `Dona ${sufixo}` },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: `Salão ${sufixo}`,
    vertical: 'lashes',
    slug: `servicos-${sufixo}-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  return { userId: data.user.id, tenantId: tenant.id }
}

beforeAll(async () => {
  ;({ userId, tenantId } = await criarConta('a'))
  ;({ userId: outroUserId, tenantId: outroTenantId } = await criarConta('b'))
}, 120_000)

afterAll(async () => {
  for (const t of [tenantId, outroTenantId]) if (t) await svc.from('tenants').delete().eq('id', t)
  for (const u of [userId, outroUserId]) if (u) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('CRUD de serviços', () => {
  it(
    'o catálogo já nasce com os 6 serviços do pack de cílios',
    async () => {
      const lista = await listarServicos(svc, tenantId)
      expect(lista).toHaveLength(6)
    },
    30_000,
  )

  it(
    'serviço novo entra no fim da lista, não em position 0 brigando com o pack',
    async () => {
      const criado = await criarServico(svc, tenantId, { ...BASE, name: `Extra ${randomUUID().slice(0, 6)}` })

      const lista = await listarServicos(svc, tenantId)
      expect(lista.at(-1)?.id).toBe(criado.id)
      expect(criado.position).toBeGreaterThan(0)
    },
    30_000,
  )

  it(
    'nome repetido devolve VALIDATION_ERROR no campo, não um 500 de constraint',
    async () => {
      const nome = `Duplicado ${randomUUID().slice(0, 6)}`
      await criarServico(svc, tenantId, { ...BASE, name: nome })

      const erro = await criarServico(svc, tenantId, { ...BASE, name: nome }).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })
      expect((erro as { details: { fields: Record<string, string> } }).details.fields).toHaveProperty('name')
    },
    30_000,
  )

  it(
    'PATCH parcial altera só o campo enviado e preserva o resto',
    async () => {
      const criado = await criarServico(svc, tenantId, {
        ...BASE,
        name: `Parcial ${randomUUID().slice(0, 6)}`,
        priceCents: 15000,
        cycleDays: 30,
      })

      const atualizado = await atualizarServico(svc, tenantId, criado.id, { priceCents: 18000 })

      expect(atualizado.price_cents).toBe(18000)
      // O que não foi enviado não pode ter virado null nem default.
      expect(atualizado.cycle_days).toBe(30)
      expect(atualizado.duration_min).toBe(BASE.durationMin)
      expect(atualizado.name).toBe(criado.name)
    },
    30_000,
  )

  it(
    'arquivar tira da lista padrão mas mantém o registro para o histórico',
    async () => {
      const criado = await criarServico(svc, tenantId, { ...BASE, name: `Arquivar ${randomUUID().slice(0, 6)}` })

      await arquivarServico(svc, tenantId, criado.id)

      const visiveis = await listarServicos(svc, tenantId)
      expect(visiveis.find((s) => s.id === criado.id)).toBeUndefined()

      // D46/D45: o registro continua lá — comanda antiga aponta para ele.
      const comArquivados = await listarServicos(svc, tenantId, true)
      expect(comArquivados.find((s) => s.id === criado.id)?.active).toBe(false)
    },
    30_000,
  )

  it(
    'reordenar grava a posição na ordem enviada',
    async () => {
      const lista = await listarServicos(svc, tenantId)
      const invertida = [...lista].reverse().map((s) => s.id)

      await reordenarServicos(svc, tenantId, invertida)

      const depois = await listarServicos(svc, tenantId)
      expect(depois.map((s) => s.id)).toEqual(invertida)
    },
    60_000,
  )

  it(
    'reordenar com id de outro tenant é recusado antes de escrever qualquer posição',
    async () => {
      const meus = await listarServicos(svc, tenantId)
      const doOutro = await listarServicos(svc, outroTenantId)
      const ordemAntes = meus.map((s) => s.id)

      const erro = await reordenarServicos(svc, tenantId, [...ordemAntes, doOutro[0]!.id]).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR' })

      // E nada foi escrito: sem a checagem prévia, os ids válidos do lote já
      // teriam sido reposicionados antes de alguém notar o intruso.
      const depois = await listarServicos(svc, tenantId)
      expect(depois.map((s) => s.id)).toEqual(ordemAntes)
    },
    60_000,
  )

  it(
    'atualizar serviço de outro tenant devolve NOT_FOUND, não altera nada',
    async () => {
      const doOutro = await listarServicos(svc, outroTenantId)
      const alvo = doOutro[0]!

      const erro = await atualizarServico(svc, tenantId, alvo.id, { priceCents: 1 }).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'NOT_FOUND' })

      const conferindo = await listarServicos(svc, outroTenantId)
      expect(conferindo.find((s) => s.id === alvo.id)?.price_cents).toBe(alvo.price_cents)
    },
    30_000,
  )
})
