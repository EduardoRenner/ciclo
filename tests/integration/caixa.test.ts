import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { concentracaoDoMes, fechamentoDiario, resumoMensal, serieMensalDeLucro } from '@/server/services/caixa'
import { executarOnboarding } from '@/server/services/onboarding'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de caixa precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
}

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const TZ = 'America/Sao_Paulo'
let tenantId: string
const tenants: string[] = []
const usuarios: string[] = []

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `caixa-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Caixa' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Caixa',
    vertical: 'nails',
    slug: `caixa-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)
}, 60_000)

afterAll(async () => {
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

async function inserirTicketFechado(closedAtIso: string, totais: { total: number; material: number; fee: number; commission: number; profit: number }) {
  await svc.from('tickets').insert({
    tenant_id: tenantId,
    status: 'closed',
    total_cents: totais.total,
    material_cost_cents: totais.material,
    fee_cents: totais.fee,
    commission_cents: totais.commission,
    profit_cents: totais.profit,
    closed_at: closedAtIso,
  })
}

describe('fechamentoDiario', () => {
  it(
    'soma só os tickets closed/paid do dia, ignora open',
    async () => {
      const dia = '2026-03-10'
      await inserirTicketFechado(`${dia}T14:00:00-03:00`, { total: 10_000, material: 1_000, fee: 300, commission: 2_000, profit: 6_700 })
      await inserirTicketFechado(`${dia}T18:00:00-03:00`, { total: 5_000, material: 500, fee: 150, commission: 1_000, profit: 3_350 })
      await svc.from('tickets').insert({ tenant_id: tenantId, status: 'open', total_cents: 99_999 })

      const resumo = await fechamentoDiario(svc, tenantId, TZ, dia)
      expect(resumo.ticketsCount).toBe(2)
      expect(resumo.revenueCents).toBe(15_000)
      expect(resumo.profitCents).toBe(10_050)
    },
    30_000,
  )

  it(
    'fechamento às 23h30 no fuso do tenant conta para o dia LOCAL, não o dia UTC seguinte',
    async () => {
      const dia = '2026-04-05'
      // 23h30 em São Paulo (-03:00) é 02h30 UTC do dia seguinte — a view
      // v_daily_cash (date_trunc em UTC) erraria isso; a implementação usa
      // limites calculados no fuso do tenant e não deve.
      await inserirTicketFechado(`${dia}T23:30:00-03:00`, { total: 7_000, material: 700, fee: 0, commission: 0, profit: 6_300 })

      const doDiaCerto = await fechamentoDiario(svc, tenantId, TZ, dia)
      expect(doDiaCerto.ticketsCount).toBe(1)
      expect(doDiaCerto.revenueCents).toBe(7_000)

      const diaSeguinteUTC = Temporal.PlainDate.from(dia).add({ days: 1 }).toString()
      const doDiaErrado = await fechamentoDiario(svc, tenantId, TZ, diaSeguinteUTC)
      expect(doDiaErrado.ticketsCount).toBe(0)
    },
    30_000,
  )

  it(
    'dia sem nenhum ticket devolve zeros, não erro',
    async () => {
      const resumo = await fechamentoDiario(svc, tenantId, TZ, '2020-01-01')
      expect(resumo).toMatchObject({ ticketsCount: 0, revenueCents: 0, profitCents: 0 })
    },
    30_000,
  )
})

describe('resumoMensal', () => {
  it(
    'soma tickets de dias diferentes dentro do mesmo mês',
    async () => {
      await inserirTicketFechado('2026-05-02T10:00:00-03:00', { total: 3_000, material: 0, fee: 0, commission: 0, profit: 3_000 })
      await inserirTicketFechado('2026-05-28T10:00:00-03:00', { total: 4_000, material: 0, fee: 0, commission: 0, profit: 4_000 })
      // Fora do mês — não pode entrar na soma de maio.
      await inserirTicketFechado('2026-06-01T10:00:00-03:00', { total: 99_999, material: 0, fee: 0, commission: 0, profit: 0 })

      const resumo = await resumoMensal(svc, tenantId, TZ, '2026-05')
      expect(resumo.ticketsCount).toBe(2)
      expect(resumo.revenueCents).toBe(7_000)
    },
    30_000,
  )
})

/**
 * `docs/48` C7. A propriedade que só o banco prova: as fatias somam exatamente o "Sobrou no mês"
 * que a MESMA tela mostra ao lado. Duas somas diferentes do mesmo dinheiro é a armadilha de
 * livro-caixa que esta base já pagou uma vez — e aqui as duas vêm de consultas diferentes.
 */
describe('concentracaoDoMes', () => {
  async function ticketComItens(
    closedAtIso: string,
    profitCents: number,
    itens: { professionalId: string | null; totalCents: number }[],
  ) {
    const { data, error } = await svc
      .from('tickets')
      .insert({ tenant_id: tenantId, status: 'closed', profit_cents: profitCents, total_cents: itens.reduce((s, i) => s + i.totalCents, 0), closed_at: closedAtIso })
      .select('id')
      .single()
    if (error) throw error
    const linhas = itens.map((i) => ({
      tenant_id: tenantId,
      ticket_id: data.id,
      professional_id: i.professionalId,
      description: 'Item de teste',
      qty: 1,
      unit_price_cents: i.totalCents,
      total_cents: i.totalCents,
      service_id: null as string | null,
      product_id: null as string | null,
    }))
    // `check (service_id is not null or product_id is not null)` na 0001 — o item precisa de um
    // dos dois. Um serviço descartável resolve sem inventar produto de revenda.
    const servico = await svc
      .from('services')
      .insert({ tenant_id: tenantId, name: `Serviço ${randomUUID().slice(0, 6)}`, duration_min: 30, price_cents: 1_000 })
      .select('id')
      .single()
    if (servico.error) throw servico.error
    const { error: erroItens } = await svc.from('ticket_items').insert(linhas.map((l) => ({ ...l, service_id: servico.data.id })))
    if (erroItens) throw erroItens
    return data.id
  }

  async function criarProfissional(nome: string) {
    const { data, error } = await svc
      .from('professionals')
      .insert({ tenant_id: tenantId, display_name: nome, comp_model: 'commission', commission_bps: 4_000 })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  it(
    'as fatias somam exatamente o lucro do mês, e a maior vira o percentual da tela',
    async () => {
      const mes = '2026-06'
      const rafa = await criarProfissional(`Rafa ${randomUUID().slice(0, 4)}`)
      const bia = await criarProfissional(`Bia ${randomUUID().slice(0, 4)}`)

      await ticketComItens(`${mes}-05T14:00:00-03:00`, 6_200, [{ professionalId: rafa, totalCents: 10_000 }])
      await ticketComItens(`${mes}-12T14:00:00-03:00`, 3_800, [{ professionalId: bia, totalCents: 6_000 }])

      const mensal = await resumoMensal(svc, tenantId, TZ, mes)
      const c = await concentracaoDoMes(svc, tenantId, TZ, mes)

      expect(c.lucroTotalCents, 'a concentração e o resumo do mês contam dinheiros diferentes').toBe(mensal.profitCents)
      expect(c.fatias.reduce((s, f) => s + f.lucroCents, 0)).toBe(mensal.profitCents)
      expect(c.maior?.professionalId).toBe(rafa)
      expect(c.maior?.participacaoBps).toBe(6_200)
      expect(c.vaiADizerAlgo).toBe(true)
      expect(c.nomes[rafa]).toMatch(/^Rafa/)
    },
    60_000,
  )

  it(
    'comanda com dois profissionais divide por peso de receita, sem perder centavo',
    async () => {
      const mes = '2026-07'
      const um = await criarProfissional(`Um ${randomUUID().slice(0, 4)}`)
      const outro = await criarProfissional(`Outro ${randomUUID().slice(0, 4)}`)

      await ticketComItens(`${mes}-03T14:00:00-03:00`, 3_333, [
        { professionalId: um, totalCents: 3_333 },
        { professionalId: outro, totalCents: 6_667 },
      ])

      const mensal = await resumoMensal(svc, tenantId, TZ, mes)
      const c = await concentracaoDoMes(svc, tenantId, TZ, mes)
      expect(c.fatias.reduce((s, f) => s + f.lucroCents, 0)).toBe(mensal.profitCents)
      expect(c.fatias).toHaveLength(2)
    },
    60_000,
  )

  it(
    'mês sem comanda nenhuma não erra e não afirma dependência de ninguém',
    async () => {
      const c = await concentracaoDoMes(svc, tenantId, TZ, '2019-01')
      expect(c.maior).toBeNull()
      expect(c.vaiADizerAlgo).toBe(false)
      expect(c.nomes).toEqual({})
    },
    30_000,
  )
})

/**
 * A prova de que o fosso do `docs/46` de fato acumula — e de que ele não se desfaz.
 *
 * A propriedade que dá valor a `monthly_profit` é uma só: **a linha nasce uma vez e nunca é
 * reescrita**. Guarda de fonte prova que ninguém escreveu `.update(`; só um teste contra Postgres
 * prova que uma segunda leitura, com os `tickets` mudados por baixo, devolve o número de antes.
 *
 * É o mesmo tipo de lacuna que "verde não é prova" nomeia: o caminho compila, a varredura passa, e
 * o comportamento que importa nunca foi exercitado.
 */
describe('serieMensalDeLucro — congela o passado e não o reescreve', () => {
  /** Meses de referência sempre no passado, para o teste não depender do dia em que roda. */
  const hoje = Temporal.PlainDate.from('2026-09-15')
  const mesPassado = '2026-08'
  const doisMesesAtras = '2026-07'

  it(
    'congela os meses encerrados na primeira leitura, e o mês CORRENTE não entra',
    async () => {
      await inserirTicketFechado(`${doisMesesAtras}-10T14:00:00Z`, { total: 20_000, material: 2_000, fee: 500, commission: 8_000, profit: 9_500 })
      await inserirTicketFechado(`${mesPassado}-10T14:00:00Z`, { total: 30_000, material: 3_000, fee: 900, commission: 12_000, profit: 14_100 })
      await inserirTicketFechado('2026-09-10T14:00:00Z', { total: 99_999, material: 0, fee: 0, commission: 0, profit: 99_999 })

      const serie = await serieMensalDeLucro(svc, tenantId, TZ, hoje.toString())
      const meses = serie.pontos.map((p) => p.month)

      expect(meses, 'agosto não foi congelado').toContain('2026-08-01')
      expect(meses, 'julho não foi congelado').toContain('2026-07-01')
      expect(meses, 'o mês corrente ainda vai mudar — congelá-lo grava um número errado para sempre').not.toContain('2026-09-01')

      const { data } = await svc.from('monthly_profit').select('month, profit_cents').eq('tenant_id', tenantId).eq('month', '2026-08-01').maybeSingle()
      expect(data?.profit_cents, 'a linha de agosto não chegou ao banco').toBe(14_100)
    },
    120_000,
  )

  it(
    'a segunda leitura não reescreve o mês, mesmo com os tickets mudados por baixo',
    async () => {
      // Uma comanda de agosto reaberta e refechada em outubro é o caso real: sem o congelamento, o
      // agosto que o dono já viu passaria a responder diferente, sem explicação.
      await inserirTicketFechado(`${mesPassado}-20T14:00:00Z`, { total: 500_000, material: 0, fee: 0, commission: 0, profit: 500_000 })

      const serie = await serieMensalDeLucro(svc, tenantId, TZ, hoje.toString())
      const agosto = serie.pontos.find((p) => p.month === '2026-08-01')

      expect(agosto?.profitCents, 'a série passou a somar um ticket que chegou depois do congelamento').toBe(14_100)

      const { count } = await svc
        .from('monthly_profit')
        .select('month', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('month', '2026-08-01')
      expect(count, 'o mês foi gravado duas vezes — a chave primária não está segurando').toBe(1)
    },
    120_000,
  )
})
