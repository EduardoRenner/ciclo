import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { aceitarConvite, criarConvite } from '@/server/services/convites'
import { definirExpediente, listarExpediente } from '@/server/services/expediente'
import { criarFolga, listarFolgas, removerFolga } from '@/server/services/folgas'
import { executarOnboarding } from '@/server/services/onboarding'
import { atualizarProfissional, criarProfissional, desativarProfissional, listarProfissionais } from '@/server/services/profissionais'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de profissionais precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let donoId: string
const usuarios: string[] = []
const tenants: string[] = []

async function criarUsuario(sufixo: string, email?: string) {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: email ?? `prof-${sufixo}-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: `Pessoa ${sufixo}` },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)
  return data.user
}

beforeAll(async () => {
  const dono = await criarUsuario('dono')
  donoId = dono.id
  const { tenant } = await executarOnboarding(svc, {
    userId: donoId,
    businessName: 'Salão do Time',
    vertical: 'barber',
    slug: `time-${randomUUID().slice(0, 8)}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('profissionais sem login', () => {
  it(
    'cria profissional sem user_id — atende sem usar o app',
    async () => {
      const criado = await criarProfissional(svc, tenantId, {
        displayName: 'Barbeiro Convidado',
        compModel: 'commission',
        commissionBps: 3000,
        rentCents: 0,
        acceptsOnline: true,
      })

      expect(criado.user_id).toBeNull()
      expect(criado.display_name).toBe('Barbeiro Convidado')

      const lista = await listarProfissionais(svc, tenantId)
      // O dono (do onboarding) + este = 2.
      expect(lista.length).toBeGreaterThanOrEqual(2)
    },
    30_000,
  )

  it(
    'PATCH parcial não zera campos não enviados',
    async () => {
      const criado = await criarProfissional(svc, tenantId, {
        displayName: 'Ajustável',
        compModel: 'rent',
        commissionBps: 0,
        rentCents: 50000,
        acceptsOnline: true,
      })

      const atualizado = await atualizarProfissional(svc, tenantId, criado.id, { acceptsOnline: false })
      expect(atualizado.accepts_online).toBe(false)
      expect(atualizado.rent_cents).toBe(50000)
      expect(atualizado.display_name).toBe('Ajustável')
    },
    30_000,
  )

  it(
    'desativar tira o profissional da lista padrão, sem apagar o registro',
    async () => {
      const criado = await criarProfissional(svc, tenantId, {
        displayName: 'Vai Sair',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })

      await desativarProfissional(svc, tenantId, criado.id)

      const ativos = await listarProfissionais(svc, tenantId)
      expect(ativos.find((p) => p.id === criado.id)).toBeUndefined()

      const todos = await listarProfissionais(svc, tenantId, true)
      expect(todos.find((p) => p.id === criado.id)?.active).toBe(false)
    },
    30_000,
  )
})

describe('expediente com múltiplos intervalos', () => {
  it(
    'substitui o expediente inteiro e aceita dois blocos no mesmo dia (manhã/tarde)',
    async () => {
      const prof = await criarProfissional(svc, tenantId, {
        displayName: 'Com Horário',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })

      await definirExpediente(svc, tenantId, {
        professionalId: prof.id,
        blocos: [
          { weekday: 1, opensAt: '09:00', closesAt: '12:00' },
          { weekday: 1, opensAt: '14:00', closesAt: '19:00' },
          { weekday: 2, opensAt: '09:00', closesAt: '18:00' },
        ],
      })

      const expediente = await listarExpediente(svc, tenantId, prof.id)
      expect(expediente).toHaveLength(3)
      expect(expediente.filter((b) => b.weekday === 1)).toHaveLength(2)
    },
    30_000,
  )

  it(
    'chamar de novo substitui, não acumula',
    async () => {
      const prof = await criarProfissional(svc, tenantId, {
        displayName: 'Reescreve Horário',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })

      await definirExpediente(svc, tenantId, {
        professionalId: prof.id,
        blocos: [{ weekday: 3, opensAt: '08:00', closesAt: '12:00' }],
      })
      await definirExpediente(svc, tenantId, {
        professionalId: prof.id,
        blocos: [{ weekday: 5, opensAt: '10:00', closesAt: '16:00' }],
      })

      const expediente = await listarExpediente(svc, tenantId, prof.id)
      expect(expediente).toHaveLength(1)
      expect(expediente[0]?.weekday).toBe(5)
    },
    30_000,
  )

  it(
    'expediente padrão do tenant (professionalId nulo) fica separado do de cada profissional',
    async () => {
      const prof = await criarProfissional(svc, tenantId, {
        displayName: 'Isolado do Padrão',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })

      await definirExpediente(svc, tenantId, { professionalId: null, blocos: [{ weekday: 0, opensAt: '10:00', closesAt: '14:00' }] })
      await definirExpediente(svc, tenantId, { professionalId: prof.id, blocos: [] })

      const padrao = await listarExpediente(svc, tenantId, null)
      const doProf = await listarExpediente(svc, tenantId, prof.id)
      expect(padrao).toHaveLength(1)
      expect(doProf).toHaveLength(0)
    },
    30_000,
  )
})

describe('folgas', () => {
  it(
    'cria, lista e remove uma folga',
    async () => {
      const prof = await criarProfissional(svc, tenantId, {
        displayName: 'Vai Tirar Folga',
        compModel: 'owner',
        commissionBps: 0,
        rentCents: 0,
        acceptsOnline: true,
      })

      const folga = await criarFolga(svc, tenantId, {
        professionalId: prof.id,
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-02T00:00:00.000Z',
        reason: 'Viagem',
      })

      const lista = await listarFolgas(svc, tenantId, prof.id)
      expect(lista.map((f) => f.id)).toContain(folga.id)

      await removerFolga(svc, tenantId, folga.id)
      const depois = await listarFolgas(svc, tenantId, prof.id)
      expect(depois.map((f) => f.id)).not.toContain(folga.id)
    },
    30_000,
  )

  it(
    'remover folga que não existe devolve NOT_FOUND',
    async () => {
      const erro = await removerFolga(svc, tenantId, randomUUID()).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})

describe('convite por link', () => {
  it(
    'ciclo completo: cria convite, aceita com o e-mail certo, vira membership + professional',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const email = `convidada-${marca}@ciclo.test`

      const { invite, token } = await criarConvite(svc, tenantId, donoId, {
        email,
        role: 'professional',
        displayName: 'Convidada Aceita',
      })
      expect(invite.email).toBe(email)

      const convidada = await criarUsuario('convidada', email)

      const resultado = await aceitarConvite(svc, { userId: convidada.id, userEmail: email, token })
      expect(resultado).toEqual({ tenantId, role: 'professional' })

      const membership = await svc.from('memberships').select('role, active').eq('tenant_id', tenantId).eq('user_id', convidada.id).single()
      expect(membership.data).toMatchObject({ role: 'professional', active: true })

      const profissional = await svc.from('professionals').select('display_name').eq('tenant_id', tenantId).eq('user_id', convidada.id).single()
      expect(profissional.data?.display_name).toBe('Convidada Aceita')
    },
    30_000,
  )

  it(
    'aceitar com e-mail diferente do convidado é recusado',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { token } = await criarConvite(svc, tenantId, donoId, {
        email: `certo-${marca}@ciclo.test`,
        role: 'reception',
      })

      const outraPessoa = await criarUsuario('errado')

      const erro = await aceitarConvite(svc, { userId: outraPessoa.id, userEmail: outraPessoa.email!, token }).catch(
        (e: unknown) => e,
      )
      expect(erro).toMatchObject({ code: 'FORBIDDEN' })
    },
    30_000,
  )

  it(
    'convite reception não vira registro em professionals — só quem atende ganha agenda',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const email = `recepcao-${marca}@ciclo.test`
      const { token } = await criarConvite(svc, tenantId, donoId, { email, role: 'reception' })
      const pessoa = await criarUsuario('recepcao', email)

      await aceitarConvite(svc, { userId: pessoa.id, userEmail: email, token })

      const profissional = await svc.from('professionals').select('id').eq('tenant_id', tenantId).eq('user_id', pessoa.id).maybeSingle()
      expect(profissional.data).toBeNull()
    },
    30_000,
  )

  it(
    'token errado ou já usado devolve NOT_FOUND, nunca detalha o motivo',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const email = `reusa-${marca}@ciclo.test`
      const { token } = await criarConvite(svc, tenantId, donoId, { email, role: 'professional' })
      const pessoa = await criarUsuario('reusa', email)

      await aceitarConvite(svc, { userId: pessoa.id, userEmail: email, token })

      // Segunda tentativa com o MESMO token — já foi aceito.
      const segunda = await aceitarConvite(svc, { userId: pessoa.id, userEmail: email, token }).catch((e: unknown) => e)
      expect(segunda).toMatchObject({ code: 'NOT_FOUND' })

      const inventado = await aceitarConvite(svc, { userId: pessoa.id, userEmail: email, token: 'token-que-nunca-existiu' }).catch(
        (e: unknown) => e,
      )
      expect(inventado).toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})
