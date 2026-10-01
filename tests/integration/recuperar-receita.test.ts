import { randomUUID } from 'node:crypto'

import { Temporal } from '@js-temporal/polyfill'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MessagingProvider } from '@/server/providers/messaging/types'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { enviarParaRecuperar, listarParaRecuperar, registrarChamadaManual } from '@/server/services/recuperar-receita'
import { gerarTokenDeVolta, registrarAberturaDoLinkDeVolta, registrarAgendamentoPeloLinkDeVolta } from '@/server/services/link-de-volta'
import { abrirLinkDeVolta } from '@/server/services/public-booking'
import { FERRAMENTAS, type ContextoFerramenta } from '@/server/assistente/ferramentas'
import { linkDaChamada, rotaDaAcao } from '@/core/assistente/acoes'

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
let slugDoTenant: string
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
  slugDoTenant = `recuperar-${marca}`
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

describe('registrarChamadaManual (docs/82 §7)', () => {
  it('o "Chamar" pelo WhatsApp do dono vira mensagem enviada, carimbo e evento de funil', async () => {
    const clientId = await criarClienteEmCiclo('Chamada Manual', { state: 'late', valueAtRiskCents: 5_000 })

    const resultado = await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })
    expect(resultado).toEqual({ registrada: true })

    const { data: mensagens } = await svc.from('messages').select('kind, status, channel, template, sent_at').eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(mensagens).toHaveLength(1)
    // É exatamente o formato que a atribuição conta (`atribuicao.ts`: kind campaign, status sent).
    expect(mensagens?.[0]).toMatchObject({ kind: 'campaign', status: 'sent', channel: 'whatsapp', template: 'recover_manual' })
    expect(mensagens?.[0]?.sent_at).not.toBeNull()

    const { data: ciclo } = await svc.from('client_cycles').select('last_campaign_at').eq('tenant_id', tenantId).eq('client_id', clientId).single()
    expect(ciclo?.last_campaign_at).not.toBeNull()

    const { data: eventos } = await svc.from('product_events').select('meta').eq('tenant_id', tenantId).eq('event_type', 'recuperacao_enviada')
    expect(eventos?.some((e) => (e.meta as { via?: string }).via === 'manual')).toBe(true)
  }, 30_000)

  it('a mesma pessoa chamada de novo na mesma semana não conta duas vezes (revisão 2026-09-23)', async () => {
    const clientId = await criarClienteEmCiclo('Chamada Repetida', { state: 'late', valueAtRiskCents: 5_000 })
    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })).toEqual({ registrada: true })
    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })).toEqual({ registrada: false, motivo: 'ja_chamada' })

    const { count } = await svc.from('messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(count).toBe(1)
  }, 30_000)

  it('quem pediu para não receber não vira mensagem enviada', async () => {
    const clientId = await criarClienteEmCiclo('Pediu Parar', { state: 'late', valueAtRiskCents: 5_000, optOut: true })
    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })).toEqual({ registrada: false, motivo: 'opt_out' })

    const { count } = await svc.from('messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(count).toBe(0)

    // E a lista já avisa a tela, para ela nem oferecer o "Chamar".
    const lista = await listarParaRecuperar(svc, tenantId)
    expect(lista.items.find((i) => i.clientId === clientId)?.optOut).toBe(true)
  }, 30_000)

  it('pela ficha (sem serviço): anota no ciclo atrasado da pessoa', async () => {
    const clientId = await criarClienteEmCiclo('Pela Ficha', { state: 'late', valueAtRiskCents: 5_000 })
    expect(await registrarChamadaManual(svc, tenantId, { clientId })).toEqual({ registrada: true })

    const { data: ciclo } = await svc.from('client_cycles').select('last_campaign_at').eq('tenant_id', tenantId).eq('client_id', clientId).single()
    expect(ciclo?.last_campaign_at).not.toBeNull()
  }, 30_000)

  it('pela ficha, pessoa no ritmo não é recuperação: nada anotado', async () => {
    const clientId = await criarClienteEmCiclo('No Ritmo', { state: 'on_track', valueAtRiskCents: 0 })
    expect(await registrarChamadaManual(svc, tenantId, { clientId })).toEqual({ registrada: false, motivo: 'sem_ciclo' })

    const { count } = await svc.from('messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(count).toBe(0)
  }, 30_000)

  it('sem ciclo daquela pessoa naquele serviço, não inventa mensagem', async () => {
    const clientId = await criarClienteEmCiclo('Sem Esse Servico', { state: 'late', valueAtRiskCents: 5_000 })
    const outroServico = randomUUID()

    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: outroServico })).toEqual({ registrada: false, motivo: 'sem_ciclo' })
    const { count } = await svc.from('messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(count).toBe(0)
  }, 30_000)
})

describe('preparar_chamada_de_volta — o "resolve" do assistente (docs/84 P2)', () => {
  const ferramenta = FERRAMENTAS.find((f) => f.nome === 'preparar_chamada_de_volta')!
  const ctx = (): ContextoFerramenta => ({ db: svc as never, tenantId, timezone: TZ })

  it('quem está na lista vira proposta com o MESMO texto do "Chamar", e a proposta executa na rota da tela', async () => {
    const marca = randomUUID().slice(0, 6)
    const clientId = await criarClienteEmCiclo(`Resolve ${marca}`, { state: 'late', valueAtRiskCents: 5_000 })

    const r = (await ferramenta.executar(ctx(), { clientId })) as { status: string; acao: string; dados: Record<string, unknown>; resumo: Record<string, unknown> }
    expect(r.status).toBe('proposta')
    expect(r.acao).toBe('chamar_de_volta')
    expect(r.dados).toMatchObject({ clientId, serviceId: servicoId })
    expect(r.resumo.Mensagem).toBe(`Oi, Resolve! Faz um tempinho desde seu último horário de esmaltação. Quer marcar essa semana?`)
    // O link abre o WhatsApp endereçado ao telefone dela, e a rota é a do "Chamar" da tela.
    expect(linkDaChamada(r.dados)).toMatch(/^https:\/\/wa\.me\/551198899\d{4}\?text=Oi%2C%20Resolve!/)
    expect(rotaDaAcao(r.acao, r.dados)).toBe('/api/v1/cycle/recover/manual')

    // Pelo NOME também — "chama a Resolve".
    const porNome = (await ferramenta.executar(ctx(), { cliente: `Resolve ${marca}` })) as { status: string; dados: Record<string, unknown> }
    expect(porNome.status).toBe('proposta')
    expect(porNome.dados.clientId).toBe(clientId)

    // E o corpo da proposta é aceito por quem executa: vira chamada anotada.
    expect(await registrarChamadaManual(svc, tenantId, { clientId: r.dados.clientId as string, serviceId: r.dados.serviceId as string })).toEqual({ registrada: true })
  }, 30_000)

  it('quem pediu para não receber não ganha mensagem pronta', async () => {
    const marca = randomUUID().slice(0, 6)
    const clientId = await criarClienteEmCiclo(`Parou ${marca}`, { state: 'late', valueAtRiskCents: 5_000, optOut: true })
    expect(await ferramenta.executar(ctx(), { clientId })).toEqual({ status: 'nao_da', motivo: 'pediu_para_nao_receber', cliente: `Parou ${marca}` })
  }, 30_000)

  it('quem está no ritmo existe, mas não está na lista — "fora da lista", nunca "não achei"', async () => {
    const marca = randomUUID().slice(0, 6)
    await criarClienteEmCiclo(`Ritmada ${marca}`, { state: 'on_track', valueAtRiskCents: 0 })
    expect(await ferramenta.executar(ctx(), { cliente: `Ritmada ${marca}` })).toEqual({ status: 'nao_da', motivo: 'fora_da_lista', cliente: `Ritmada ${marca}` })
    expect(await ferramenta.executar(ctx(), { cliente: `Ninguem ${marca}` })).toEqual({ status: 'nao_achei', oQue: 'cliente', termo: `Ninguem ${marca}` })
  }, 30_000)
})

describe('link de volta: clique e agendamento na mensagem do "Chamar" (docs/95 E1)', () => {
  async function agendamentoDe(clientId: string) {
    const { data: prof } = await svc.from('professionals').select('id').eq('tenant_id', tenantId).limit(1).single()
    const inicio = Temporal.Now.instant().add({ hours: 48 })
    const { data, error } = await svc
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        professional_id: prof!.id,
        service_id: servicoId,
        starts_at: inicio.toString(),
        ends_at: inicio.add({ minutes: 60 }).toString(),
        status: 'confirmed',
        price_cents: 10_000,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }

  it('abrir o link marca a chamada uma vez; agendar por ele liga o agendamento à chamada', async () => {
    const clientId = await criarClienteEmCiclo('Abriu o Link', { state: 'late', valueAtRiskCents: 5_000 })
    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })).toEqual({ registrada: true })
    const alvo = { tenantId, clientId, serviceId: servicoId }

    expect(await registrarAberturaDoLinkDeVolta(svc, alvo)).toBe(true)
    const { data: aberta } = await svc.from('messages').select('clicked_at').eq('tenant_id', tenantId).eq('client_id', clientId).single()
    expect(aberta?.clicked_at).not.toBeNull()

    // Abrir de novo não move a primeira marca.
    expect(await registrarAberturaDoLinkDeVolta(svc, alvo, Temporal.Now.instant().add({ hours: 1 }))).toBe(false)
    const { data: reaberta } = await svc.from('messages').select('clicked_at').eq('tenant_id', tenantId).eq('client_id', clientId).single()
    expect(reaberta?.clicked_at).toBe(aberta?.clicked_at)

    const agendamentoId = await agendamentoDe(clientId)
    expect(await registrarAgendamentoPeloLinkDeVolta(svc, alvo, agendamentoId)).toBe(true)
    const { data: agendada } = await svc
      .from('messages')
      .select('booked_appointment_id, clicked_at')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .single()
    expect(agendada?.booked_appointment_id).toBe(agendamentoId)
    expect(agendada?.clicked_at).toBe(aberta?.clicked_at)
  }, 30_000)

  it('sem chamada anotada na janela, abrir e agendar não marcam nada (e não lançam)', async () => {
    const clientId = await criarClienteEmCiclo('Nunca Chamada', { state: 'late', valueAtRiskCents: 5_000 })
    const alvo = { tenantId, clientId, serviceId: servicoId }
    expect(await registrarAberturaDoLinkDeVolta(svc, alvo)).toBe(false)
    expect(await registrarAgendamentoPeloLinkDeVolta(svc, alvo, await agendamentoDe(clientId))).toBe(false)
    const { count } = await svc.from('messages').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('client_id', clientId)
    expect(count).toBe(0)
  }, 30_000)

  it('chamada fora da janela de 14 dias não é dona do clique', async () => {
    const clientId = await criarClienteEmCiclo('Chamada Antiga', { state: 'late', valueAtRiskCents: 5_000 })
    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })).toEqual({ registrada: true })
    const daquiA15Dias = Temporal.Now.instant().add({ hours: 15 * 24 })
    expect(await registrarAberturaDoLinkDeVolta(svc, { tenantId, clientId, serviceId: servicoId }, daquiA15Dias)).toBe(false)
  }, 30_000)

  it('a página pública só aceita o link do PRÓPRIO salão: token de outro tenant não marca nada', async () => {
    const clientId = await criarClienteEmCiclo('Link Alheio', { state: 'late', valueAtRiskCents: 5_000 })
    expect(await registrarChamadaManual(svc, tenantId, { clientId, serviceId: servicoId })).toEqual({ registrada: true })

    const deOutroSalao = gerarTokenDeVolta({ tenantId: randomUUID(), clientId, serviceId: servicoId })
    expect(await abrirLinkDeVolta(slugDoTenant, deOutroSalao)).toBeNull()
    const { data: intacta } = await svc.from('messages').select('clicked_at').eq('tenant_id', tenantId).eq('client_id', clientId).single()
    expect(intacta?.clicked_at).toBeNull()

    // Controle positivo: o token do próprio salão abre e devolve o serviço do link.
    const doSalao = gerarTokenDeVolta({ tenantId, clientId, serviceId: servicoId })
    expect(await abrirLinkDeVolta(slugDoTenant, doSalao)).toEqual({ serviceId: servicoId })
    const { data: aberta } = await svc.from('messages').select('clicked_at').eq('tenant_id', tenantId).eq('client_id', clientId).single()
    expect(aberta?.clicked_at).not.toBeNull()
  }, 30_000)
})
