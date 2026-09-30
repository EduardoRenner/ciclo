import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { arquivarServico, criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { listarParaRecuperar } from '@/server/services/recuperar-receita'
import { recomputarCiclosDoTenant } from '@/server/services/ciclo'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de serviço arquivado precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let servicoAtivoId: string
let servicoArquivadoId: string
const tenants: string[] = []
const usuarios: string[] = []

/*
 * BL-48 (`.claude/ciclo/autonomous-backlog.md`): serviço arquivado (`arquivarServico`,
 * `active: false`) não pode continuar aparecendo como "atrasado para voltar" nas duas telas de
 * dinheiro do Motor de Ciclo. O achado tinha três partes — job noturno (TypeScript puro, coberto
 * por unit), e as duas views (`v_recover_revenue`, `v_clientes_a_recuperar`), cobertas aqui contra
 * o banco de verdade, porque `create or replace view` só se prova certo com Postgres real.
 */
beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `servico-arquivado-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Arquivamento' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Arquivamento',
    vertical: 'barber',
    slug: `servico-arquivado-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const ativo = await criarServico(svc, tenantId, {
    name: 'Corte BL48',
    description: null,
    durationMin: 40,
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
  servicoAtivoId = ativo.id

  const arquivado = await criarServico(svc, tenantId, {
    name: 'Progressiva BL48 (descontinuada)',
    description: null,
    durationMin: 120,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 20_000,
    pricingModel: 'fixed',
    cycleDays: 21,
    depositBps: 0,
    depositMinCents: 0,
    parallelCapacity: 1,
    requiresAnamnesis: false,
    bookableOnline: true,
    categoryId: null,
  })
  servicoArquivadoId = arquivado.id
  await arquivarServico(svc, tenantId, servicoArquivadoId)
})

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
})

async function cliente(nome: string, telefone: string) {
  const { data, error } = await svc.from('clients').insert({ tenant_id: tenantId, name: nome, phone_e164: telefone }).select('id').single()
  if (error) throw error
  return data.id
}

async function ciclo(clientId: string, serviceId: string, state: Database['public']['Enums']['cycle_state']) {
  const { error } = await svc.from('client_cycles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    service_id: serviceId,
    personal_cycle_days: 21,
    state,
    late_days: state === 'on_track' ? 0 : 15,
    value_at_risk_cents: state === 'on_track' ? 0 : 3_000,
    profit_at_risk_cents: state === 'on_track' ? 0 : 2_500,
  })
  if (error) throw error
}

describe('v_recover_revenue não mostra serviço arquivado', () => {
  it('cliente atrasada num serviço arquivado não aparece em listarParaRecuperar', async () => {
    const clientId = await cliente('Só No Arquivado', '+5511977001001')
    await ciclo(clientId, servicoArquivadoId, 'late')

    const lista = await listarParaRecuperar(svc, tenantId)
    expect(lista.items.find((i) => i.clientId === clientId)).toBeUndefined()
  })

  it('a mesma cliente aparece quando o ciclo atrasado é de um serviço ATIVO', async () => {
    const clientId = await cliente('No Ativo', '+5511977001002')
    await ciclo(clientId, servicoAtivoId, 'late')

    const lista = await listarParaRecuperar(svc, tenantId)
    expect(lista.items.find((i) => i.clientId === clientId)).toBeDefined()
  })
})

describe('o job noturno para de atualizar ciclo de serviço arquivado', () => {
  it('recomputarCiclosDoTenant não toca a linha de client_cycles de um serviço arquivado', async () => {
    const clientId = await cliente('Congelada', '+5511977001005')
    await ciclo(clientId, servicoArquivadoId, 'late')

    const antes = await svc
      .from('client_cycles')
      .select('computed_at, late_days')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('service_id', servicoArquivadoId)
      .single()

    // Avança "hoje" o suficiente para o late_days mudar SE o job tocasse a linha — se ela continuar
    // idêntica, é porque o serviço arquivado saiu do mapa `cycleDaysPorServico`/`precoPorServico`
    // (guarda `if (!defaultCycleDays) continue`, já existia) e a combinação virou "desconhecida".
    await recomputarCiclosDoTenant(svc, tenantId, TZ, '2026-06-01')

    const depois = await svc
      .from('client_cycles')
      .select('computed_at, late_days')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('service_id', servicoArquivadoId)
      .single()

    expect(depois.data).toEqual(antes.data)
  })
})

describe('v_clientes_a_recuperar (alerta do Hoje) ignora ciclo de serviço arquivado dos dois lados', () => {
  it('único ciclo não-em-dia é de serviço arquivado: não conta como "sumindo"', async () => {
    const clientId = await cliente('Só Arquivado No Alerta', '+5511977001003')
    await ciclo(clientId, servicoArquivadoId, 'late')

    const { data } = await svc.from('v_clientes_a_recuperar').select('client_id').eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(data ?? []).toHaveLength(0)
  })

  it('ciclo em dia no serviço ARQUIVADO não blinda quem está atrasada no serviço ativo', async () => {
    const clientId = await cliente('Em Dia No Arquivado E Atrasada No Ativo', '+5511977001004')
    await ciclo(clientId, servicoArquivadoId, 'on_track')
    await ciclo(clientId, servicoAtivoId, 'late')

    const { data } = await svc.from('v_clientes_a_recuperar').select('client_id, ja_atrasado').eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(data).toHaveLength(1)
    expect(data?.[0]?.ja_atrasado).toBe(true)
  })
})
