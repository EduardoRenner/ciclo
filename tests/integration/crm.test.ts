import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarCliente } from '@/server/services/clientes'
import { margensDoClube } from '@/server/services/clube'
import { EsquemaCampanha, fichaDoCliente, painelDaCarteira, publicoDaCampanha, registrarCampanha } from '@/server/services/crm'
import {
  assinar,
  assinaturaAtiva,
  cancelarAssinatura,
  criarPlano,
  extratoDePontos,
  lancarPontos,
} from '@/server/services/fidelidade'
import { listarModelos, MODELOS_PADRAO } from '@/server/services/mensagens-prontas'
import { criarNota, listarNotas } from '@/server/services/notas'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('CRM precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string
let servicoId: string
let profissionalId: string
let fielId: string
let optOutId: string
let semOptInId: string

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `crm-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dono do CRM' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Barbearia de Teste',
    vertical: 'barber',
    slug: `crm-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Barbeiro',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  profissionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Corte de Teste',
    description: null,
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 5000,
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

  const fiel = await criarCliente(svc, tenantId, {
    name: 'Cliente Fiel',
    phone: '11988770001',
    tags: ['fiel'],
    marketingOptIn: true,
    preferences: { maquina: '2', barba: 'navalha' },
  })
  fielId = fiel.id

  const optOut = await criarCliente(svc, tenantId, {
    name: 'Pediu Para Parar',
    phone: '11988770002',
    tags: [],
    marketingOptIn: true,
  })
  optOutId = optOut.id
  await svc.from('clients').update({ whatsapp_opt_out: true }).eq('id', optOutId)

  const semOptIn = await criarCliente(svc, tenantId, {
    name: 'Nunca Autorizou',
    phone: '11988770003',
    tags: [],
    marketingOptIn: false,
  })
  semOptInId = semOptIn.id

  // Dois atendimentos concluídos do cliente fiel, para a ficha ter métrica e histórico.
  const base = new Date()
  base.setUTCDate(base.getUTCDate() - 30)
  for (const diasAtras of [30, 10]) {
    const inicio = new Date()
    inicio.setUTCDate(inicio.getUTCDate() - diasAtras)
    inicio.setUTCHours(13, 0, 0, 0)
    const { error: erroAg } = await svc.from('appointments').insert({
      tenant_id: tenantId,
      client_id: fielId,
      professional_id: profissionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      status: 'done',
      price_cents: 5000,
      completed_at: inicio.toISOString(),
    })
    if (erroAg) throw new Error(`seed de agendamento falhou: ${erroAg.message}`)
  }

  // `visits_count`/`ltv_cents` são mantidos por job; aqui o teste escreve o que o job escreveria.
  await svc.from('clients').update({ visits_count: 2, ltv_cents: 10_000 }).eq('id', fielId)
}, 90_000)

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
}, 60_000)

describe('fichaDoCliente', () => {
  it(
    'devolve métricas, preferências e histórico juntos',
    async () => {
      const ficha = await fichaDoCliente(svc, tenantId, fielId, 'America/Sao_Paulo')

      expect(ficha.cliente.name).toBe('Cliente Fiel')
      expect(ficha.cliente.preferences).toEqual({ maquina: '2', barba: 'navalha' })
      expect(ficha.metricas.visitas).toBe(2)
      expect(ficha.metricas.ltvCents).toBe(10_000)
      // Ticket médio é derivado, não guardado: 10000 / 2.
      expect(ficha.metricas.ticketMedioCents).toBe(5_000)
      expect(ficha.historico).toHaveLength(2)
      expect(ficha.historico[0]!.serviceName).toBe('Corte de Teste')

      // CRM profundo (migration 0019): a ficha agrega tudo isso mesmo sem nenhum dado
      // preenchido — nasce em zero/null/vazio, nunca quebra por ausência.
      expect(ficha.cliente.document).toBeNull()
      expect(ficha.cliente.preferredProfessionalName).toBeNull()
      expect(ficha.pontos).toEqual({ saldo: 0, lancamentos: [] })
      expect(ficha.assinatura).toBeNull()
      expect(ficha.pacotes).toEqual([])
      expect(ficha.saldoCarteiraCents).toBe(0)
      expect(ficha.notas).toEqual([])
      expect(ficha.saude).toEqual({ temFicha: false, temAlerta: false, alerta: null })
    },
    30_000,
  )

  it(
    'cliente que nunca veio não quebra o ticket médio com divisão por zero',
    async () => {
      const ficha = await fichaDoCliente(svc, tenantId, semOptInId, 'America/Sao_Paulo')
      expect(ficha.metricas.visitas).toBe(0)
      expect(ficha.metricas.ticketMedioCents).toBe(0)
      expect(ficha.historico).toEqual([])
    },
    30_000,
  )

  it(
    'consentimento image_use: consentId só aparece ativo (concedido e não revogado) — TICKET-114',
    async () => {
      const { registrarConsentimento, revogarConsentimento } = await import('@/server/services/consentimentos')

      const antes = await fichaDoCliente(svc, tenantId, semOptInId, 'America/Sao_Paulo')
      expect(antes.consentimentos.find((c) => c.kind === 'image_use')?.consentId).toBeNull()

      const gravado = await registrarConsentimento(svc, tenantId, semOptInId, { kind: 'image_use', version: '1.0', text: 'texto', granted: true }, { ip: null, userAgent: null })
      const concedido = await fichaDoCliente(svc, tenantId, semOptInId, 'America/Sao_Paulo')
      expect(concedido.consentimentos.find((c) => c.kind === 'image_use')?.consentId).toBe(gravado.id)

      await revogarConsentimento(svc, tenantId, semOptInId, 'image_use')
      const revogado = await fichaDoCliente(svc, tenantId, semOptInId, 'America/Sao_Paulo')
      expect(revogado.consentimentos.find((c) => c.kind === 'image_use')?.consentId).toBeNull()
    },
    30_000,
  )

  it(
    'id de outro tenant devolve NOT_FOUND, não a ficha alheia',
    async () => {
      const erro = await fichaDoCliente(svc, randomUUID(), fielId, 'America/Sao_Paulo').catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'NOT_FOUND' })
    },
    30_000,
  )
})

describe('publicoDaCampanha', () => {
  it(
    'nunca inclui quem pediu para não receber nem quem não deu opt-in de marketing',
    async () => {
      const alvos = await publicoDaCampanha(svc, tenantId, 'todos')
      const ids = alvos.map((a) => a.id)

      expect(ids).toContain(fielId)
      expect(ids).not.toContain(optOutId)
      expect(ids).not.toContain(semOptInId)
    },
    30_000,
  )

  it(
    'segmento sem ninguém devolve lista vazia em vez de trazer a carteira toda',
    async () => {
      // Ninguém está atrasado neste tenant recém-criado (nem há `client_cycles`).
      expect(await publicoDaCampanha(svc, tenantId, 'sumidos')).toEqual([])
    },
    30_000,
  )
})

describe('registrarCampanha', () => {
  it(
    'grava a campanha e uma mensagem por pessoa — é o que a atribuição de receita procura',
    async () => {
      const campanha = await registrarCampanha(svc, tenantId, {
        name: 'Teste de campanha',
        segment: 'todos',
        template: 'Agradecer',
        clientIds: [fielId],
      })

      expect(campanha.sent_count).toBe(1)
      // Conversão nasce zerada: quem preenche é a atribuição, não quem disparou.
      expect(campanha.booked_count).toBe(0)
      expect(campanha.revenue_cents).toBe(0)

      const { data: mensagens } = await svc
        .from('messages')
        .select('client_id, kind, status')
        .eq('tenant_id', tenantId)
        .eq('kind', 'campaign')

      expect(mensagens).toHaveLength(1)
      expect(mensagens![0]).toMatchObject({ client_id: fielId, kind: 'campaign', status: 'sent' })
    },
    30_000,
  )

  it('campanha sem ninguém é barrada no esquema, antes de virar linha no banco', () => {
    const vazia = EsquemaCampanha.safeParse({ name: 'Vazia', segment: 'todos', template: 'x', clientIds: [] })
    expect(vazia.success).toBe(false)

    const comGente = EsquemaCampanha.safeParse({
      name: 'Cheia',
      segment: 'todos',
      template: 'x',
      clientIds: [randomUUID()],
    })
    expect(comGente.success).toBe(true)
  })
})

describe('painelDaCarteira', () => {
  it(
    'conta a carteira e calcula ticket médio e taxa de retorno pela view agregada',
    async () => {
      const painel = await painelDaCarteira(svc, tenantId)

      // O onboarding não cria cliente; os três são os do seed deste teste.
      expect(painel.total).toBe(3)
      expect(painel.novosNoMes).toBe(3)
      // Só o fiel tem visita: 10000 centavos / 2 visitas.
      expect(painel.ticketMedioCents).toBe(5_000)
      // 1 de 3 clientes voltou mais de uma vez = 3333 bps.
      expect(painel.taxaRetornoBps).toBe(3_333)
    },
    30_000,
  )
})

describe('notas do cliente', () => {
  it(
    'cada anotação é uma linha nova, com data — não sobrescreve a anterior',
    async () => {
      await criarNota(svc, tenantId, fielId, userId, { body: 'Primeira visita, gostou do corte curto.' })
      await criarNota(svc, tenantId, fielId, userId, { body: 'Pediu para deixar mais comprido dessa vez.' })

      const notas = await listarNotas(svc, tenantId, fielId)
      expect(notas.length).toBeGreaterThanOrEqual(2)
      expect(notas[0]!.body).toBe('Pediu para deixar mais comprido dessa vez.')
      expect(notas[1]!.body).toBe('Primeira visita, gostou do corte curto.')
    },
    30_000,
  )
})

describe('fidelidade — pontos', () => {
  it(
    'soma e resgate refletem no saldo, e o extrato guarda o motivo de cada lançamento',
    async () => {
      await lancarPontos(svc, tenantId, fielId, userId, { points: 50, reason: 'Corte de hoje' })
      await lancarPontos(svc, tenantId, fielId, userId, { points: -20, reason: 'Resgate de brinde' })

      const extrato = await extratoDePontos(svc, tenantId, fielId)
      expect(extrato.saldo).toBeGreaterThanOrEqual(30)
      expect(extrato.lancamentos.some((l) => l.reason === 'Resgate de brinde' && l.points === -20)).toBe(true)
    },
    30_000,
  )

  it(
    'resgate maior que o saldo é recusado — cliente nunca fica devendo ponto',
    async () => {
      const erro = await lancarPontos(svc, tenantId, semOptInId, userId, {
        points: -999_999,
        reason: 'resgate impossível',
      }).catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR' })
    },
    30_000,
  )
})

describe('clube de assinatura', () => {
  it(
    'assinar, consultar e cancelar — cancelar muda o estado, não apaga a linha',
    async () => {
      const plano = await criarPlano(svc, tenantId, {
        name: 'Plano de teste',
        priceCents: 9_900,
        sessionsPerMonth: 4,
        active: true,
      })

      await assinar(svc, tenantId, semOptInId, { planId: plano.id, billingDay: 10 }, 'America/Sao_Paulo')
      const ativa = await assinaturaAtiva(svc, tenantId, semOptInId)
      expect(ativa).toMatchObject({ planName: 'Plano de teste', priceCents: 9_900, billingDay: 10 })

      await cancelarAssinatura(svc, tenantId, ativa!.id)
      expect(await assinaturaAtiva(svc, tenantId, semOptInId)).toBeNull()

      const { data: linha } = await svc
        .from('client_subscriptions')
        .select('status, canceled_on')
        .eq('id', ativa!.id)
        .single()
      expect(linha).toMatchObject({ status: 'canceled' })
      expect(linha!.canceled_on).not.toBeNull()
    },
    30_000,
  )

  it(
    'segunda assinatura ativa para o mesmo cliente é recusada',
    async () => {
      const plano = await criarPlano(svc, tenantId, {
        name: 'Segundo plano',
        priceCents: 5_000,
        sessionsPerMonth: null,
        active: true,
      })

      await assinar(svc, tenantId, optOutId, { planId: plano.id, billingDay: 1 }, 'America/Sao_Paulo')
      const erro = await assinar(svc, tenantId, optOutId, { planId: plano.id, billingDay: 15 }, 'America/Sao_Paulo').catch((e: unknown) => e)
      expect(erro).toMatchObject({ code: 'VALIDATION_ERROR' })

      await cancelarAssinatura(svc, tenantId, (await assinaturaAtiva(svc, tenantId, optOutId))!.id)
    },
    30_000,
  )

  it(
    'C-07 — visita concluída no ciclo conta contra o limite, e passar do limite avisa em vez de travar',
    async () => {
      const cliente = await criarCliente(svc, tenantId, { name: 'Assinante do Limite', tags: [], marketingOptIn: false })
      const plano = await criarPlano(svc, tenantId, { name: 'Plano 2x', priceCents: 8_000, sessionsPerMonth: 2, active: true })
      // `billingDay` = hoje, pro ciclo atual cobrir "agora" sem depender de qual dia o teste roda.
      const hoje = new Date()
      await assinar(svc, tenantId, cliente.id, { planId: plano.id, billingDay: hoje.getUTCDate() }, 'America/Sao_Paulo')

      // Ainda sem visita: 2 de 2 restantes, não excedeu.
      const antes = await assinaturaAtiva(svc, tenantId, cliente.id, 'America/Sao_Paulo')
      expect(antes).toMatchObject({ restantes: 2, excedeuLimite: false })

      // 3 atendimentos concluídos HOJE — passa do limite de 2.
      for (let i = 0; i < 3; i++) {
        const inicio = new Date()
        inicio.setUTCHours(10 + i, 0, 0, 0)
        const { error: erroAg } = await svc.from('appointments').insert({
          tenant_id: tenantId,
          client_id: cliente.id,
          professional_id: profissionalId,
          service_id: servicoId,
          starts_at: inicio.toISOString(),
          ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
          status: 'done',
          price_cents: 5000,
          completed_at: inicio.toISOString(),
        })
        if (erroAg) throw new Error(`seed de agendamento falhou: ${erroAg.message}`)
      }

      const depois = await assinaturaAtiva(svc, tenantId, cliente.id, 'America/Sao_Paulo')
      expect(depois, 'passou do limite mas a assinatura sumiu ou parou de contar').toMatchObject({
        visitasNoCiclo: 3,
        restantes: 0,
        excedeuLimite: true,
      })
      // O ponto central de C-07: excedeu É INFORMAÇÃO, não motivo pra assinatura desaparecer ou
      // pra `assinaturaAtiva` lançar. A pessoa continua sendo atendida.

      await cancelarAssinatura(svc, tenantId, depois!.id)
    },
    30_000,
  )
})

describe('listarModelos', () => {
  it(
    'na primeira vez semeia a biblioteca padrão, e não duplica na segunda',
    async () => {
      const primeira = await listarModelos(svc, tenantId)
      expect(primeira).toHaveLength(MODELOS_PADRAO.length)

      const segunda = await listarModelos(svc, tenantId)
      expect(segunda).toHaveLength(MODELOS_PADRAO.length)
      expect(segunda.map((m) => m.slug).sort()).toEqual(primeira.map((m) => m.slug).sort())
    },
    30_000,
  )
})

/**
 * `docs/48` C6, `docs/47` P06. Só o banco prova a costura: a visita de assinante não passa por
 * comanda, então o custo é montado a partir da comissão configurada e da ficha de consumo — duas
 * tabelas diferentes, com uma janela de cobrança que não é o mês do calendário.
 */
describe('margem do clube de assinatura', () => {
  it(
    'assinante que veio demais aparece no vermelho, com a ficha de consumo dentro da conta',
    async () => {
      const marca = randomUUID().slice(0, 6)

      const profissional = await criarProfissional(svc, tenantId, {
        displayName: `Comissionado ${marca}`,
        compModel: 'commission',
        commissionBps: 5_000, // 50%
        rentCents: 0,
        acceptsOnline: true,
      })

      const servico = await criarServico(svc, tenantId, {
        name: `Corte do Clube ${marca}`,
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

      const produto = await svc
        .from('products')
        .insert({ tenant_id: tenantId, name: `Pomada ${marca}`, stock_qty: 100, avg_cost_cents: 200 })
        .select('id')
        .single()
      if (produto.error) throw produto.error
      await svc.from('service_products').insert({ tenant_id: tenantId, service_id: servico.id, product_id: produto.data.id, qty: 1 })

      const plano = await criarPlano(svc, tenantId, {
        name: `Ilimitado ${marca}`,
        priceCents: 9_000,
        sessionsPerMonth: null,
        benefits: null,
        active: true,
      })

      const assinante = await criarCliente(svc, tenantId, { name: `Assinante ${marca}`, phone: null, tags: [], marketingOptIn: false })
      // Dia 1 garante que a janela corrente começa no dia 1 deste mês, sem depender de quando o
      // teste roda no calendário.
      await assinar(svc, tenantId, assinante.id, { planId: plano.id, billingDay: 1 }, 'America/Sao_Paulo')

      // Quatro cortes no ciclo: 4 × (R$ 25 de comissão + R$ 2 de pomada) = R$ 108, contra R$ 90.
      const hoje = new Date()
      for (let i = 0; i < 4; i++) {
        const quando = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), Math.min(hoje.getUTCDate(), 28), 15, 0, 0))
        quando.setUTCMinutes(quando.getUTCMinutes() - i * 60)
        const { error } = await svc.from('appointments').insert({
          tenant_id: tenantId,
          client_id: assinante.id,
          service_id: servico.id,
          professional_id: profissional.id,
          starts_at: quando.toISOString(),
          ends_at: new Date(quando.getTime() + 30 * 60_000).toISOString(),
          price_cents: 5_000,
          status: 'done',
        })
        if (error) throw error
      }

      const margens = await margensDoClube(svc, tenantId, 'America/Sao_Paulo')
      const dele = margens.find((m) => m.clientId === assinante.id)

      expect(dele, 'o assinante não apareceu na lista de margens').toBeDefined()
      expect(dele!.visitas).toBe(4)
      expect(dele!.custoCents, 'comissão de 50% + R$ 2 de ficha, quatro vezes').toBe(4 * (2_500 + 200))
      expect(dele!.margemCents).toBe(9_000 - 10_800)
      expect(dele!.noPrejuizo).toBe(true)
      expect(dele!.acimaDoLimite, 'plano ilimitado não tem limite para estourar').toBe(false)
      expect(dele!.visitasSemMaterialConfiavel).toBe(0)

      // Pior primeiro: quem abre a tela quer ver quem está no vermelho, não conferir quem está bem.
      expect(margens[0]!.clientId).toBe(assinante.id)
    },
    90_000,
  )

  it(
    'salão sem assinante nenhum devolve lista vazia, não erro',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { data } = await svc.auth.admin.createUser({
        email: `clube-vazio-${marca}@ciclo.test`,
        password: randomUUID(),
        email_confirm: true,
      })
      const { tenant } = await executarOnboarding(svc, {
        userId: data!.user!.id,
        businessName: 'Sem Clube',
        vertical: 'barber',
        slug: `clube-vazio-${marca}`,
        timezone: 'America/Sao_Paulo',
      })

      expect(await margensDoClube(svc, tenant.id, 'America/Sao_Paulo')).toEqual([])

      await svc.from('tenants').delete().eq('id', tenant.id)
      await svc.auth.admin.deleteUser(data!.user!.id)
    },
    60_000,
  )
})

/**
 * `docs/48` C2. Só o banco prova as duas metades: o lucro vem das comandas fechadas (congelado, o
 * mesmo número do caixa) e a cobertura vem da diferença entre visitas concluídas e comandas —
 * duas tabelas, sem uma segunda conta em lugar nenhum.
 */
describe('lucro por cliente na ficha', () => {
  it(
    'soma o lucro congelado das comandas e diz de quantas visitas está falando',
    async () => {
      const marca = randomUUID().slice(0, 6)
      const cliente = await criarCliente(svc, tenantId, { name: `Lucrativo ${marca}`, phone: null, tags: [], marketingOptIn: false })

      // Duas visitas concluídas; só uma virou comanda fechada.
      const agora = new Date()
      for (let i = 0; i < 2; i++) {
        const quando = new Date(agora.getTime() - (i + 1) * 24 * 3_600_000)
        const { error } = await svc.from('appointments').insert({
          tenant_id: tenantId,
          client_id: cliente.id,
          service_id: servicoId,
          professional_id: profissionalId,
          starts_at: quando.toISOString(),
          ends_at: new Date(quando.getTime() + 1_800_000).toISOString(),
          price_cents: 5_000,
          status: 'done',
        })
        if (error) throw error
      }

      const { error: erroTicket } = await svc
        .from('tickets')
        .insert({ tenant_id: tenantId, client_id: cliente.id, status: 'closed', total_cents: 5_000, profit_cents: 3_200, closed_at: agora.toISOString() })
      if (erroTicket) throw erroTicket

      const semPermissao = await fichaDoCliente(svc, tenantId, cliente.id, 'America/Sao_Paulo')
      expect(semPermissao.metricas.lucro, 'sem `podeVerLucro` a consulta nem deveria acontecer').toBeNull()

      const ficha = await fichaDoCliente(svc, tenantId, cliente.id, 'America/Sao_Paulo', { podeVerLucro: true })
      expect(ficha.metricas.ltvCents, 'o faturamento continua sendo a soma dos preços').toBe(10_000)
      expect(ficha.metricas.lucro!.lucroCents).toBe(3_200)
      expect(ficha.metricas.lucro!.cobertura, 'uma visita ficou sem comanda').toBe('parcial')
      expect(ficha.metricas.lucro!.visitasSemComanda).toBe(1)
    },
    90_000,
  )
})
