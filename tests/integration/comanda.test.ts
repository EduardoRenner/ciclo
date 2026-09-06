import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { adicionarItemComanda, atualizarDescontoEGorjeta, buscarComanda, fecharComanda, removerItemComanda } from '@/server/services/comanda'

import type { Database, Json } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de comanda precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
let professionalId: string
let servicoId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `comanda-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona da Comanda' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão da Comanda',
    vertical: 'nails',
    slug: `comanda-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure',
    compModel: 'commission',
    commissionBps: 4_000, // 40%
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação em Gel',
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

async function abrirTicketVazio() {
  const cliente = await svc.from('clients').insert({ tenant_id: tenantId, name: `Cliente ${randomUUID().slice(0, 6)}` }).select('id').single()
  const ticket = await svc.from('tickets').insert({ tenant_id: tenantId, client_id: cliente.data!.id, professional_id: professionalId }).select('id').single()
  return ticket.data!.id
}

describe('comanda — abrir, itens, desconto, gorjeta, fechar', () => {
  it(
    'soma dos itens bate com o subtotal e o total, mesmo com qty decimal',
    async () => {
      const ticketId = await abrirTicketVazio()

      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 0.5, unitPriceCents: 7_777, discountCents: 500 })

      const { ticket, items } = await buscarComanda(svc, tenantId, ticketId)
      const somaItens = items.reduce((s, i) => s + i.total_cents, 0)

      expect(items).toHaveLength(2)
      expect(ticket.subtotal_cents).toBe(somaItens)
      expect(ticket.total_cents).toBe(somaItens) // sem desconto/gorjeta ainda
    },
    30_000,
  )

  it(
    'desconto e gorjeta no nível da comanda entram no total: subtotal - desconto + gorjeta',
    async () => {
      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })

      await atualizarDescontoEGorjeta(svc, tenantId, ticketId, { discountCents: 1_000, tipCents: 2_000 })

      const { ticket } = await buscarComanda(svc, tenantId, ticketId)
      expect(ticket.subtotal_cents).toBe(10_000)
      expect(ticket.total_cents).toBe(11_000) // 10.000 - 1.000 + 2.000
    },
    30_000,
  )

  it(
    'remover item recalcula o subtotal',
    async () => {
      const ticketId = await abrirTicketVazio()
      const item1 = await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })

      await removerItemComanda(svc, tenantId, ticketId, item1.id)

      const { ticket, items } = await buscarComanda(svc, tenantId, ticketId)
      expect(items).toHaveLength(1)
      expect(ticket.subtotal_cents).toBe(10_000)
    },
    30_000,
  )

  it(
    'fechar congela a comissão do momento — mudar o percentual do profissional depois não altera a linha',
    async () => {
      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })

      const fechado = await fecharComanda(svc, tenantId, ticketId, 'cash')
      expect(fechado.status).toBe('closed')
      expect(fechado.closed_at).not.toBeNull()
      expect(fechado.commission_cents).toBe(4_000) // 40% de 10.000 (compModel commission, 4000 bps)

      await svc.from('professionals').update({ commission_bps: 1_000 }).eq('id', professionalId)

      const { items } = await buscarComanda(svc, tenantId, ticketId)
      expect(items[0]!.commission_bps).toBe(4_000) // continua o valor congelado no fechamento
    },
    30_000,
  )

  it(
    'fechar comanda vazia é recusado — não faz sentido cobrar nada',
    async () => {
      const ticketId = await abrirTicketVazio()
      await expect(fecharComanda(svc, tenantId, ticketId, 'cash')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
    },
    30_000,
  )

  it(
    'não dá pra adicionar item numa comanda já fechada',
    async () => {
      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await fecharComanda(svc, tenantId, ticketId, 'cash')

      await expect(adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })).rejects.toMatchObject({
        code: 'INVALID_TRANSITION',
      })
    },
    30_000,
  )
})


/**
 * Achados de dinheiro e de corrida da auditoria de 2026-08-28. Os dois moram aqui porque só o
 * banco de verdade prova: o teste de `tests/integration/caixa.test.ts` insere `profit_cents` na
 * mão, então ele somava certo um número que `fecharComanda` tinha calculado errado, e o verde
 * cobria os dois lados.
 */
describe('comanda — o que sobra e a trava de estado', () => {
  it(
    'o desconto da comanda sai do lucro: sobrar mais do que entrou era possível',
    async () => {
      // A comissão é FIXADA aqui, não herdada do `beforeAll`: o teste do congelamento, acima,
      // muda `commission_bps` para 1.000 e não restaura. Este teste é sobre a aritmética do
      // desconto, então ele não pode depender da ordem em que a suíte roda — foi assim que a
      // primeira versão dele reprovou na CI esperando 4.000 e recebendo 1.000.
      await svc.from('professionals').update({ commission_bps: 4_000 }).eq('id', professionalId)

      const ticketId = await abrirTicketVazio()
      // Serviço de R$ 100, comissão de 40% (R$ 40), sem material. Desconto de R$ 20 na comanda.
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await atualizarDescontoEGorjeta(svc, tenantId, ticketId, { discountCents: 2_000, tipCents: 0 })

      const fechado = await fecharComanda(svc, tenantId, ticketId, 'cash')

      expect(fechado.total_cents).toBe(8_000) // 10.000 - 2.000
      expect(fechado.commission_cents, 'a comissão não é a que este teste fixou — a aritmética abaixo não vale').toBe(4_000)
      // Antes: 10.000 - 0 - 4.000 = 6.000, e a tela mostrava "Entrou 80, Sobrou 60" com o
      // desconto sumindo do relatório.
      expect(fechado.profit_cents).toBe(4_000) // (10.000 - 2.000) - 0 - 4.000
      expect(fechado.profit_cents).toBeLessThanOrEqual(fechado.total_cents)
    },
    30_000,
  )

  it(
    'a gorjeta entra no total e não vira lucro do salão',
    async () => {
      await svc.from('professionals').update({ commission_bps: 4_000 }).eq('id', professionalId)

      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
      await atualizarDescontoEGorjeta(svc, tenantId, ticketId, { discountCents: 0, tipCents: 3_000 })

      const fechado = await fecharComanda(svc, tenantId, ticketId, 'cash')

      expect(fechado.total_cents).toBe(13_000)
      expect(fechado.profit_cents).toBe(6_000) // 10.000 - 4.000 de comissão; a gorjeta é do profissional
      expect(fechado.profit_cents).toBeLessThanOrEqual(fechado.total_cents)
    },
    30_000,
  )

  it(
    'fechar a mesma comanda duas vezes ao mesmo tempo fecha uma vez só',
    async () => {
      const ticketId = await abrirTicketVazio()
      await adicionarItemComanda(svc, tenantId, ticketId, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })

      // Simultâneas de verdade: é a janela entre ler `status = 'open'` e escrever `closed` que o
      // `.eq('status', 'open')` do UPDATE fechou. Em série as duas já eram recusadas antes.
      const resultados = await Promise.allSettled([
        fecharComanda(svc, tenantId, ticketId, 'cash'),
        fecharComanda(svc, tenantId, ticketId, 'cash'),
      ])

      const aceitas = resultados.filter((r) => r.status === 'fulfilled')
      expect(aceitas, 'as duas chamadas fecharam a mesma comanda').toHaveLength(1)

      // A consequência de verdade: `baixarEstoqueDaComanda` não é idempotente, então a segunda
      // passagem teria descido o estoque de novo. Sem produto na ficha não há movimento nenhum —
      // e é justamente isso que precisa continuar valendo.
      const { data: movimentos } = await svc.from('stock_moves').select('id').eq('tenant_id', tenantId).eq('source_id', ticketId)
      expect(movimentos ?? []).toHaveLength(0)

      const { data: depois } = await svc.from('tickets').select('status, closed_at').eq('id', ticketId).single()
      expect(depois!.status).toBe('closed')
    },
    30_000,
  )
})

/**
 * `docs/49`: até a `0066`, `tickets.fee_cents` existia, era subtraída pela conta do lucro e somada
 * pelo caixa — e **nada no projeto a escrevia**. O "Sobrou" do salão que passa no cartão era
 * faturamento menos material e comissão, com a maquininha invisível.
 *
 * Só o banco de verdade prova este par: o percentual sai de `tenants.settings`, o valor é gravado
 * na comanda, e o congelamento só existe se `fee_bps` continuar o de ontem depois de o dono
 * renegociar a taxa.
 */
describe('comanda — a taxa da maquininha', () => {
  async function abrirComItem() {
    const { data, error } = await svc.from('tickets').insert({ tenant_id: tenantId, professional_id: professionalId, status: 'open' }).select('id').single()
    if (error) throw error
    await adicionarItemComanda(svc, tenantId, data.id, { serviceId: servicoId, professionalId, qty: 1, discountCents: 0 })
    return data.id
  }

  async function gravarTaxas(taxas: Record<string, number>) {
    const { data } = await svc.from('tenants').select('settings').eq('id', tenantId).single()
    const settings = (data?.settings ?? {}) as Record<string, unknown>
    const { error } = await svc.from('tenants').update({ settings: { ...settings, payment_fees_bps: taxas } }).eq('id', tenantId)
    if (error) throw error
  }

  it(
    'crédito a 3,49% sai do lucro; dinheiro na mesma comanda não tira nada',
    async () => {
      await svc.from('professionals').update({ commission_bps: 4_000 }).eq('id', professionalId)
      await gravarTaxas({ cash: 0, pix: 0, debit: 149, credit: 349, other: 0 })

      const noCredito = await fecharComanda(svc, tenantId, await abrirComItem(), 'credit')
      expect(noCredito.payment_method).toBe('credit')
      expect(noCredito.fee_bps).toBe(349)
      expect(noCredito.fee_cents).toBe(349) // 3,49% de R$ 100
      expect(noCredito.profit_cents).toBe(10_000 - 4_000 - 349)

      const noDinheiro = await fecharComanda(svc, tenantId, await abrirComItem(), 'cash')
      expect(noDinheiro.fee_cents).toBe(0)
      expect(noDinheiro.profit_cents, 'a mesma comanda sobra mais em dinheiro — é o ponto').toBe(10_000 - 4_000)
      expect(noDinheiro.profit_cents).toBeGreaterThan(noCredito.profit_cents)
    },
    60_000,
  )

  it(
    'a maquininha cobra sobre a gorjeta também, e o salão paga por um dinheiro que não fica com ele',
    async () => {
      await svc.from('professionals').update({ commission_bps: 4_000 }).eq('id', professionalId)
      await gravarTaxas({ cash: 0, pix: 0, debit: 149, credit: 349, other: 0 })

      const ticketId = await abrirComItem()
      await atualizarDescontoEGorjeta(svc, tenantId, ticketId, { discountCents: 0, tipCents: 2_000 })
      const fechado = await fecharComanda(svc, tenantId, ticketId, 'credit')

      expect(fechado.total_cents).toBe(12_000)
      expect(fechado.fee_cents, 'a taxa saiu do subtotal, e não do que passou na máquina').toBe(419) // 3,49% de 12.000
      expect(fechado.profit_cents).toBe(10_000 - 4_000 - 419)
    },
    60_000,
  )

  it(
    'renegociar a maquininha em novembro não muda o lucro de agosto',
    async () => {
      await svc.from('professionals').update({ commission_bps: 4_000 }).eq('id', professionalId)
      await gravarTaxas({ cash: 0, pix: 0, debit: 149, credit: 349, other: 0 })

      const fechado = await fecharComanda(svc, tenantId, await abrirComItem(), 'credit')
      await gravarTaxas({ cash: 0, pix: 0, debit: 149, credit: 199, other: 0 })

      const { data: depois } = await svc.from('tickets').select('fee_bps, fee_cents, profit_cents').eq('id', fechado.id).single()
      expect(depois!.fee_bps, 'o percentual congelado seguiu a taxa nova').toBe(349)
      expect(depois!.fee_cents).toBe(349)
      expect(depois!.profit_cents).toBe(fechado.profit_cents)
    },
    60_000,
  )

  it(
    'sem taxa configurada, nada é inventado — a comanda fecha com zero e diz qual foi a forma',
    async () => {
      const { data } = await svc.from('tenants').select('settings').eq('id', tenantId).single()
      const settings: Record<string, Json> = { ...((data?.settings ?? {}) as Record<string, Json>) }
      delete settings.payment_fees_bps
      await svc.from('tenants').update({ settings }).eq('id', tenantId)

      const fechado = await fecharComanda(svc, tenantId, await abrirComItem(), 'credit')
      expect(fechado.fee_bps).toBe(0)
      expect(fechado.fee_cents).toBe(0)
      expect(fechado.payment_method, 'a forma de pagamento se perde quando não há taxa').toBe('credit')
    },
    60_000,
  )
})
