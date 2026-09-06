import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { enviarParaRecuperar, listarParaRecuperar } from '@/server/services/recuperar-receita'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de recuperar-receita precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `recuperar-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Recuperar' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Recuperar',
    vertical: 'nails',
    slug: `recuperar-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 10_000,
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
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

let contadorTelefone = 0

/**
 * `profitAtRiskCents` omitido cai no valor da receita, e isso é de propósito: a `0067` fez a fila
 * ser ordenada pelo LUCRO, e sem esse padrão todos os casos antigos passariam a ordenar por zero —
 * a suíte continuaria verde por empate, provando nada.
 */
async function criarClienteEmCiclo(
  nome: string,
  opcoes: { state: Database['public']['Enums']['cycle_state']; valueAtRiskCents: number; profitAtRiskCents?: number; optOut?: boolean },
) {
  contadorTelefone++
  // Telefone único por cliente: `clients_unique_phone` (tenant_id, phone_e164) rejeitaria o
  // segundo insert com o mesmo número, e o teste original usava um número fixo para todos.
  const telefone = `+551198899${String(contadorTelefone).padStart(4, '0')}`
  const cliente = await svc
    .from('clients')
    .insert({ tenant_id: tenantId, name: nome, phone_e164: telefone, whatsapp_opt_out: opcoes.optOut ?? false })
    .select('id')
    .single()
  if (cliente.error) throw cliente.error
  const clientId = cliente.data.id

  await svc.from('client_cycles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    service_id: servicoId,
    personal_cycle_days: 21,
    last_visit_on: '2026-07-01',
    predicted_on: '2026-07-22',
    late_days: 15,
    state: opcoes.state,
    value_at_risk_cents: opcoes.valueAtRiskCents,
    profit_at_risk_cents: opcoes.profitAtRiskCents ?? opcoes.valueAtRiskCents,
  })

  return clientId
}

// 14h em São Paulo: dentro da janela permitida (8h–21h, §7), sem depender da
// hora real em que o teste roda — 21h40 no relógio de verdade já quebrou uma
// versão anterior deste teste.
const DENTRO_DA_JANELA = Temporal.ZonedDateTime.from('2026-08-18T14:00:00-03:00[America/Sao_Paulo]').toInstant()

/**
 * 21h30, depois de fechar a loja — e é a hora em que o dono de verdade senta para chamar a base.
 *
 * A janela 8h–21h nunca teve caso de teste. Enquanto ela devolvia o mesmo `rate_limited` do
 * dedupe de 7 dias, não havia o que distinguir: a tela dizia "opt-out ou limite de mensagens" e
 * ele concluía que os 40 clientes tinham pedido para não receber, quando bastava tentar de manhã.
 */
const FORA_DA_JANELA = Temporal.ZonedDateTime.from('2026-08-18T21:30:00-03:00[America/Sao_Paulo]').toInstant()

/** 9h do dia seguinte: a hora em que a tentativa das 21h30 deveria poder ser refeita. */
const MANHA_SEGUINTE = Temporal.ZonedDateTime.from('2026-08-19T09:00:00-03:00[America/Sao_Paulo]').toInstant()

function providerQueSempreFunciona(): MessagingProvider {
  return {
    sendTemplate: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    sendText: vi.fn(async () => ({ providerId: `wamid.${randomUUID()}` })),
    parseWebhook: vi.fn(),
  }
}

describe('listarParaRecuperar', () => {
  it(
    'totalValueCents soma o filtro inteiro, items respeita o limit',
    async () => {
      await criarClienteEmCiclo('Devedora A', { state: 'late', valueAtRiskCents: 5_000 })
      await criarClienteEmCiclo('Devedora B', { state: 'at_risk', valueAtRiskCents: 3_000 })

      const tudo = await listarParaRecuperar(svc, tenantId)
      expect(tudo.totalValueCents).toBeGreaterThanOrEqual(8_000)
      expect(tudo.count).toBeGreaterThanOrEqual(2)

      const soLate = await listarParaRecuperar(svc, tenantId, { state: 'late' })
      expect(soLate.items.every((i) => i.state === 'late')).toBe(true)
    },
    30_000,
  )
})

describe('enviarParaRecuperar', () => {
  it(
    'envia para quem não está em opt-out, pula quem está',
    async () => {
      const podeReceber = await criarClienteEmCiclo('Pode Receber', { state: 'due', valueAtRiskCents: 8_500 })
      const emOptOut = await criarClienteEmCiclo('Pediu Pra Parar', { state: 'due', valueAtRiskCents: 8_500, optOut: true })

      const resultado = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        {
          items: [
            { clientId: podeReceber, serviceId: servicoId },
            { clientId: emOptOut, serviceId: servicoId },
          ],
          mode: 'template',
        },
        providerQueSempreFunciona(),
        DENTRO_DA_JANELA,
      )

      expect(resultado.queued).toBe(1)
      expect(resultado.skipped).toEqual([{ clientId: emOptOut, reason: 'opt_out' }])

      const linha = await svc
        .from('client_cycles')
        .select('last_campaign_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', podeReceber)
        .single()
      expect(linha.data?.last_campaign_at).not.toBeNull()
    },
    30_000,
  )

  it(
    'segunda tentativa em menos de 7 dias é recusada por rate_limited',
    async () => {
      const cliente = await criarClienteEmCiclo('Já Avisada Hoje', { state: 'late', valueAtRiskCents: 4_000 })

      const primeira = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        { items: [{ clientId: cliente, serviceId: servicoId }], mode: 'template' },
        providerQueSempreFunciona(),
        DENTRO_DA_JANELA,
      )
      expect(primeira.queued).toBe(1)

      const segunda = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        { items: [{ clientId: cliente, serviceId: servicoId }], mode: 'template' },
        providerQueSempreFunciona(),
        DENTRO_DA_JANELA,
      )
      expect(segunda.queued).toBe(0)
      expect(segunda.skipped).toEqual([{ clientId: cliente, reason: 'rate_limited' }])
    },
    30_000,
  )

  it(
    'fora da janela 8h–21h tem motivo próprio, e não gasta a trava de 7 dias',
    async () => {
      const cliente = await criarClienteEmCiclo('Chamada às 21h30', { state: 'late', valueAtRiskCents: 6_000 })

      const tarde = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        { items: [{ clientId: cliente, serviceId: servicoId }], mode: 'template' },
        providerQueSempreFunciona(),
        FORA_DA_JANELA,
      )

      expect(tarde.queued).toBe(0)
      // Antes vinha `rate_limited`, indistinguível de "já avisei essa pessoa esta semana".
      expect(tarde.skipped).toEqual([{ clientId: cliente, reason: 'fora_de_janela' }])

      // E a metade que dá sentido à distinção: não enviar às 21h30 não pode queimar a chance de
      // enviar às 9h. `last_campaign_at` continua nulo, então a tentativa de manhã passa.
      const cedo = await enviarParaRecuperar(
        svc,
        tenantId,
        TZ,
        { items: [{ clientId: cliente, serviceId: servicoId }], mode: 'template' },
        providerQueSempreFunciona(),
        MANHA_SEGUINTE,
      )
      expect(cedo.queued).toBe(1)
    },
    30_000,
  )
})

/**
 * `docs/48` C3. A tela promete, com estas palavras, que a ordem é a do que vale a pena chamar — e
 * "valer" passou a ser o LUCRO. Este caso existe porque a troca é invisível quando os dois números
 * andam juntos: só separa quem ordena por um e quem ordena pelo outro quando eles discordam.
 */
describe('a fila de recuperação é ordenada por lucro, não por receita', () => {
  it(
    'o serviço caro que deixa pouco fica abaixo do barato que deixa mais',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const { data } = await svc.auth.admin.createUser({
        email: `ordem-${marca}@ciclo.test`,
        password: randomUUID(),
        email_confirm: true,
      })
      const { tenant } = await executarOnboarding(svc, {
        userId: data!.user!.id,
        businessName: 'Ordem por Lucro',
        vertical: 'barber',
        slug: `ordem-${marca}`,
        timezone: TZ,
      })

      const servico = await svc
        .from('services')
        .insert({ tenant_id: tenant.id, name: 'Serviço da Ordem', duration_min: 30, price_cents: 10_000 })
        .select('id')
        .single()
      if (servico.error) throw servico.error

      const criar = async (nome: string, receita: number, lucro: number) => {
        const c = await svc.from('clients').insert({ tenant_id: tenant.id, name: nome, phone_e164: null }).select('id').single()
        if (c.error) throw c.error
        const { error } = await svc.from('client_cycles').insert({
          tenant_id: tenant.id,
          client_id: c.data.id,
          service_id: servico.data.id,
          personal_cycle_days: 21,
          last_visit_on: '2026-07-01',
          predicted_on: '2026-07-22',
          late_days: 15,
          state: 'late',
          value_at_risk_cents: receita,
          profit_at_risk_cents: lucro,
        })
        if (error) throw error
        return c.data.id
      }

      // Platinado: R$ 200 de receita, R$ 50 de lucro. Corte: R$ 80 de receita, R$ 80 de lucro.
      const platinado = await criar('Dona do Platinado', 20_000, 5_000)
      const corte = await criar('Dono do Corte', 8_000, 8_000)

      const lista = await listarParaRecuperar(svc, tenant.id)
      expect(lista.items.map((i) => i.clientId), 'a fila voltou a ser ordenada por receita').toEqual([corte, platinado])
      expect(lista.totalValueCents, 'a receita parada continua sendo a soma da receita').toBe(28_000)
      expect(lista.totalProfitCents).toBe(13_000)

      await svc.from('tenants').delete().eq('id', tenant.id)
      await svc.auth.admin.deleteUser(data!.user!.id)
    },
    90_000,
  )
})
