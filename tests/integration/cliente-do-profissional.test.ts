import { randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { exigirClienteDoProfissional } from '@/server/services/clientes'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  throw new Error('O teste do alcance do profissional precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

/*
 * APR-040: `vault:own` e `client:own` eram tratados como `all` pelas rotas, e o cofre abria com o
 * cliente de serviço — qualquer profissional com AAL2 lia a anamnese de qualquer cliente do negócio
 * (medido na APR-039). A regra única: o profissional alcança quem ele ATENDE (horário em qualquer
 * estado, ou comanda). Exercitada com o JWT do profissional, como na rota, nos dois modos do
 * `restrict_professional_view`.
 */
let tenantId: string
let servicoId: string
let profissional: { professionalId: string; db: SupabaseClient<Database> }
let colegaId: string
const usuarios: string[] = []
let deslocamento = 0

async function cliente(nome: string) {
  const r = await svc.from('clients').insert({ tenant_id: tenantId, name: `${nome} ${randomUUID().slice(0, 4)}` }).select('id').single()
  if (r.error) throw r.error
  return r.data.id
}

async function horario(clientId: string, professionalId: string, status: 'done' | 'no_show' | 'pending', diasAtras: number) {
  // Cada horário 2 h depois do anterior: os dois modos repetem os mesmos dias e a trava de sobreposição recusaria.
  const inicio = new Date(Date.now() - diasAtras * 86_400_000 + deslocamento++ * 2 * 3_600_000)
  const r = await svc.from('appointments').insert({
    tenant_id: tenantId,
    client_id: clientId,
    professional_id: professionalId,
    service_id: servicoId,
    starts_at: inicio.toISOString(),
    ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
    status,
    price_cents: 5_000,
  })
  if (r.error) throw r.error
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const dono = await svc.auth.admin.createUser({ email: `apr040-dono-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true })
  if (dono.error || !dono.data.user) throw new Error(`seed falhou: ${dono.error?.message}`)
  usuarios.push(dono.data.user.id)
  const { tenant } = await executarOnboarding(svc, { userId: dono.data.user.id, businessName: 'Salão APR-040', vertical: 'barber', slug: `apr040-${marca}`, timezone: 'America/Sao_Paulo' })
  tenantId = tenant.id
  servicoId = (await svc.from('services').select('id').eq('tenant_id', tenantId).limit(1).single()).data!.id

  const email = `apr040-prof-${marca}@ciclo.test`
  const senha = randomUUID()
  const u = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true })
  if (u.error || !u.data.user) throw new Error(`seed falhou: ${u.error?.message}`)
  usuarios.push(u.data.user.id)
  await svc.from('memberships').insert({ tenant_id: tenantId, user_id: u.data.user.id, role: 'professional' })
  const p = await svc.from('professionals').insert({ tenant_id: tenantId, user_id: u.data.user.id, display_name: 'Ana' }).select('id').single()
  if (p.error) throw p.error
  colegaId = (await svc.from('professionals').insert({ tenant_id: tenantId, display_name: 'Bia' }).select('id').single()).data!.id

  const db = createClient<Database>(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const login = await db.auth.signInWithPassword({ email, password: senha })
  if (login.error) throw login.error
  profissional = { professionalId: p.data.id, db }
}, 60_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('profissional alcança só quem atende (APR-040)', () => {
  for (const restrito of [false, true]) {
    describe(restrito ? 'agenda só do profissional' : 'agenda do negócio inteiro (padrão)', () => {
      beforeAll(async () => {
        await svc.from('tenants').update({ settings: { restrict_professional_view: restrito } }).eq('id', tenantId)
      })

      it(
        'cliente que ele atendeu, que faltou ou que está marcado com ele: alcança',
        async () => {
          const atendida = await cliente('Atendida')
          const faltou = await cliente('Faltou')
          const marcada = await cliente('Marcada')
          await horario(atendida, profissional.professionalId, 'done', 20)
          await horario(faltou, profissional.professionalId, 'no_show', 10)
          await horario(marcada, profissional.professionalId, 'pending', -2)
          for (const id of [atendida, faltou, marcada]) {
            await expect(exigirClienteDoProfissional(profissional.db, tenantId, id)).resolves.toBeUndefined()
          }
        },
        30_000,
      )

      it(
        'cliente só da colega, ou sem horário nenhum: 403',
        async () => {
          const daColega = await cliente('Da colega')
          const semHorario = await cliente('Sem horário')
          await horario(daColega, colegaId, 'done', 15)
          for (const id of [daColega, semHorario]) {
            await expect(exigirClienteDoProfissional(profissional.db, tenantId, id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
          }
        },
        30_000,
      )
    })
  }

  it(
    'comanda sem horário (venda de balcão com ele) também conta',
    async () => {
      const balcao = await cliente('Balcão')
      const t = await svc.from('tickets').insert({ tenant_id: tenantId, client_id: balcao, professional_id: profissional.professionalId }).select('id').single()
      if (t.error) throw t.error
      await expect(exigirClienteDoProfissional(profissional.db, tenantId, balcao)).resolves.toBeUndefined()
    },
    30_000,
  )
})
