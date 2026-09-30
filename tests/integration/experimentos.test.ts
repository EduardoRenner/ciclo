import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarCliente } from '@/server/services/clientes'
import { cancelarExperimento, criarExperimento, listarExperimentos } from '@/server/services/experimentos'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Experimentos precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const TZ = 'America/Sao_Paulo'

let tenantId: string
let userId: string
let profissionalId: string
let servicoId: string
let clienteId: string

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({ email: `exp-${marca}@ciclo.test`, password: randomUUID(), email_confirm: true, user_metadata: { full_name: 'Dona do Teste' } })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id
  const { tenant } = await executarOnboarding(svc, { userId, businessName: 'Salão dos Testes', vertical: 'barber', slug: `exp-${marca}`, timezone: TZ })
  tenantId = tenant.id
  const { data: prof } = await svc.from('professionals').select('id').eq('tenant_id', tenantId).limit(1).single()
  profissionalId = prof!.id
  servicoId = (
    await criarServico(svc, tenantId, {
      name: 'Corte do Experimento',
      description: null,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      priceCents: 5_000,
      pricingModel: 'fixed',
      cycleDays: 21,
      depositBps: 0,
      depositMinCents: 0,
      parallelCapacity: 1,
      requiresAnamnesis: false,
      bookableOnline: true,
      categoryId: null,
    })
  ).id
  clienteId = (await criarCliente(svc, tenantId, { name: 'Cliente do Teste', phone: null, tags: [], marketingOptIn: false })).id
}, 90_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
}, 60_000)

async function concluido(startsAt: string, priceCents = 5_000) {
  const { error } = await svc.from('appointments').insert({
    tenant_id: tenantId,
    client_id: clienteId,
    professional_id: profissionalId,
    service_id: servicoId,
    starts_at: startsAt,
    ends_at: new Date(new Date(startsAt).getTime() + 30 * 60_000).toISOString(),
    status: 'done',
    price_cents: priceCents,
  })
  if (error) throw error
}

describe('experimentos (docs/84 Aposta C)', () => {
  it(
    'o antes é CONGELADO na criação, no fuso do salão; o depois é medido dos atendimentos',
    async () => {
      // Teste de 14 dias começando em 01/10: o antes é 17/09 a 30/09.
      await concluido('2026-09-18T15:00:00Z')
      await concluido('2026-09-25T15:00:00Z')
      // 01/10 01:30 UTC = 30/09 22:30 em São Paulo → é ANTES. Quem contasse em UTC poria no teste.
      await concluido('2026-10-01T01:30:00Z')
      // 16/09 é antes do antes: fora.
      await concluido('2026-09-16T15:00:00Z')

      const { id } = await criarExperimento(svc, tenantId, TZ, userId, { titulo: 'Abrir a quinta à noite', metrica: 'atendimentos', weekday: null, startsOn: '2026-10-01', dias: 14 }, '2026-10-01')

      const { data: linha } = await svc.from('experiments').select('baseline').eq('id', id).single()
      expect(linha!.baseline).toEqual({ de: '2026-09-17', ate: '2026-09-30', atendimentos: 3, atendidoCents: 15_000 })

      // Um atendimento do período de antes concluído DEPOIS de criar o teste não mexe no antes.
      await concluido('2026-09-20T15:00:00Z')
      // E o período de teste.
      for (const dia of ['02', '03', '06', '09']) await concluido(`2026-10-${dia}T15:00:00Z`)

      const [exp] = await listarExperimentos(svc, tenantId, TZ, '2026-10-20')
      expect(exp!.leitura.antes.atendimentos, 'o antes não pode mudar depois de guardado').toBe(3)
      expect(exp!.leitura.estado).toBe('concluido')
      expect(exp!.leitura.durante.atendimentos).toBe(4)
      // 3 + 4 = 7 atendimentos: pouco para ler diferença, e a frase diz isso em vez de "subiu 33%".
      expect(exp!.leitura.frase).toMatch(/pouco movimento para ler diferença/)
      expect(exp!.leitura.amostra).toBe('Indicativo: 14 dias de teste, 7 atendimentos somando os dois períodos.')
    },
    60_000,
  )

  it(
    'teste não começa no passado — o antes não pode ser escolhido depois de ver o resultado',
    async () => {
      const erro = await criarExperimento(svc, tenantId, TZ, userId, { titulo: 'Retroativo', metrica: 'atendimentos', weekday: null, startsOn: '2026-09-30', dias: 14 }, '2026-10-01').catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR', details: { fields: { startsOn: 'O teste começa hoje ou depois.' } } })
      const { count } = await svc.from('experiments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('titulo', 'Retroativo')
      expect(count).toBe(0)
    },
    30_000,
  )

  it(
    'cancelar é marcar, não apagar; cancelar de novo não reescreve a data',
    async () => {
      const { id } = await criarExperimento(svc, tenantId, TZ, userId, { titulo: 'Para cancelar', metrica: 'atendido_cents', weekday: 4, startsOn: '2026-11-05', dias: 14 }, '2026-10-01')
      expect(await cancelarExperimento(svc, tenantId, id)).toEqual({ cancelado: true })
      const { data: primeiro } = await svc.from('experiments').select('canceled_at, weekday').eq('id', id).single()
      expect(primeiro!.canceled_at).not.toBeNull()
      expect(primeiro!.weekday).toBe(4)

      expect(await cancelarExperimento(svc, tenantId, id)).toEqual({ cancelado: false })
      const { data: segundo } = await svc.from('experiments').select('canceled_at').eq('id', id).single()
      expect(segundo!.canceled_at).toBe(primeiro!.canceled_at)

      const lista = await listarExperimentos(svc, tenantId, TZ, '2026-10-01')
      expect(lista.find((e) => e.id === id)?.leitura).toMatchObject({ estado: 'cancelado', frase: 'Teste cancelado.' })

      await expect(cancelarExperimento(svc, tenantId, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})
