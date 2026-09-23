import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'
import { executarOnboarding } from '@/server/services/onboarding'
import { concluirAgendamento, confirmarAgendamento, criarAgendamento, marcarChegada } from '@/server/services/agendamentos'
import { recomputarCiclosDoTenant, recomputarCicloDeUmAtendimento } from '@/server/services/ciclo'
import { prestacaoDeContasDoMotor, oscilacaoDaReguaDoTenant } from '@/server/services/previsao'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('O teste de ciclo precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.')
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
    email: `ciclo-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dona do Ciclo' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  usuarios.push(data.user.id)

  const { tenant } = await executarOnboarding(svc, {
    userId: data.user.id,
    businessName: 'Salão do Ciclo',
    vertical: 'nails',
    slug: `ciclo-${marca}`,
    timezone: TZ,
  })
  tenantId = tenant.id
  tenants.push(tenantId)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Manicure do Ciclo',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  professionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Esmaltação',
    description: null,
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 6000,
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

async function criarCliente(nome: string) {
  const c = await svc.from('clients').insert({ tenant_id: tenantId, name: nome }).select('id').single()
  return c.data!.id
}

async function inserirAtendimentoConcluido(clientId: string, diasAtras: number) {
  const inicio = new Date(Date.now() - diasAtras * 86_400_000)
  const { error } = await svc.from('appointments').insert({
    tenant_id: tenantId,
    client_id: clientId,
    professional_id: professionalId,
    service_id: servicoId,
    starts_at: inicio.toISOString(),
    ends_at: new Date(inicio.getTime() + 3_600_000).toISOString(),
    status: 'done',
    price_cents: 6000,
  })
  if (error) throw error
}

describe('recomputarCiclosDoTenant', () => {
  it(
    'cliente sem retorno esperado ainda vira due/late — grava em client_cycles',
    async () => {
      const cliente = await criarCliente('Sumiu Há 30 Dias')
      await inserirAtendimentoConcluido(cliente, 30) // ciclo padrão 21, 30 dias atrás = 9 dias de atraso → late

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('state, late_days, value_at_risk_cents, profit_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      expect(linha.data?.state).toBe('late')
      // §5.3: preço do serviço (6000 centavos) × probabilidade de 'late' (0,65), arredondado para baixo.
      expect(linha.data?.value_at_risk_cents).toBe(3900)
      /*
        `0067`: o lucro em risco sai da MESMA probabilidade, sobre o que sobra do serviço. Este
        profissional é `owner` (comissão 0) e o serviço não tem ficha de consumo, então lucro
        esperado = preço, e os dois números coincidem. Coincidirem AQUI é o que prova que a coluna
        nova está sendo escrita — antes da 0067 ela não existia, e um default 0 passaria batido.
      */
      expect(linha.data?.profit_at_risk_cents).toBe(3900)
    },
    30_000,
  )

  it(
    'cliente com agendamento futuro fica on_track mesmo atrasadíssimo',
    async () => {
      const cliente = await criarCliente('Atrasadíssima Mas Já Remarcou')
      await inserirAtendimentoConcluido(cliente, 90)

      await criarAgendamento(
        svc,
        tenantId,
        TZ,
        null,
        {
          clientId: cliente,
          serviceId: servicoId,
          professionalId,
          startsAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
          origin: 'app',
        },
        {},
      )

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc.from('client_cycles').select('state').eq('tenant_id', tenantId).eq('client_id', cliente).single()
      expect(linha.data?.state).toBe('on_track')
    },
    30_000,
  )

  it(
    'idempotente: rodar duas vezes seguidas dá o mesmo resultado, sem duplicar linha',
    async () => {
      const cliente = await criarCliente('Roda Duas Vezes')
      await inserirAtendimentoConcluido(cliente, 40)
      await inserirAtendimentoConcluido(cliente, 15)

      const hoje = new Date().toISOString().slice(0, 10)
      const colunas = 'personal_cycle_days, last_visit_on, predicted_on, state, late_days'
      await recomputarCiclosDoTenant(svc, tenantId, TZ, hoje)
      const primeira = await svc.from('client_cycles').select(colunas).eq('tenant_id', tenantId).eq('client_id', cliente).single()
      await recomputarCiclosDoTenant(svc, tenantId, TZ, hoje)
      const segunda = await svc.from('client_cycles').select(colunas).eq('tenant_id', tenantId).eq('client_id', cliente).single()

      /*
        Rodada 17 (docs/82): o recálculo passou a LER `last_visit_on`, que ele mesmo escreve. Se a
        leitura somasse a data mesmo quando ela é só o último atendimento, a 2ª rodada teria a
        mesma visita duas vezes (intervalo zero) e o ritmo pessoal de todo mundo encolheria toda
        madrugada. Dois atendimentos, e não um, porque com um só não há intervalo para distorcer.
      */
      expect(primeira.data, 'cenário não montado: a 1ª rodada não gravou').toBeTruthy()
      expect(segunda.data).toEqual(primeira.data)

      const { count } = await svc
        .from('client_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
      expect(count).toBe(1)
    },
    30_000,
  )

  it(
    'concluir um atendimento recalcula o ciclo daquela combinação em tempo real, sem esperar o job',
    async () => {
      const cliente = await criarCliente('Recalcula na Hora')

      const ag = await criarAgendamento(
        svc,
        tenantId,
        TZ,
        null,
        {
          clientId: cliente,
          serviceId: servicoId,
          professionalId,
          startsAt: new Date(Date.now() + 3_600_000).toISOString(),
          origin: 'app',
        },
        {},
      )
      await confirmarAgendamento(svc, tenantId, ag.id)
      await marcarChegada(svc, tenantId, ag.id)
      await concluirAgendamento(svc, tenantId, ag.id)

      // Sem chamar recomputarCiclosDoTenant — só concluir já deve ter criado a linha.
      const linha = await svc.from('client_cycles').select('state').eq('tenant_id', tenantId).eq('client_id', cliente).single()
      expect(linha.data).not.toBeNull()
    },
    30_000,
  )
})

/**
 * `docs/DECISOES.md` 2026-09-18. Assinante ativo do CICLO Clube não paga avulso — `value_at_risk`/
 * `profit_at_risk` usando `services.price_cents` para ele contaria uma venda que nunca ia
 * acontecer. O ESTADO (`late`/`due`/...) continua calculado normalmente; só o dinheiro zera.
 */
describe('recomputarCiclosDoTenant — assinante do clube', () => {
  it(
    'assinante ativo: state continua "late", mas value_at_risk e profit_at_risk zeram',
    async () => {
      const cliente = await criarCliente('Assinante Atrasada')
      await inserirAtendimentoConcluido(cliente, 30) // mesmo cenário do teste base: 30 dias, late

      const plano = await svc
        .from('subscription_plans')
        .insert({ tenant_id: tenantId, name: 'Plano do Ciclo', price_cents: 9900, sessions_per_month: 2 })
        .select('id')
        .single()
      await svc.from('client_subscriptions').insert({
        tenant_id: tenantId,
        client_id: cliente,
        plan_id: plano.data!.id,
        billing_day: 5,
        status: 'active',
      })

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('state, value_at_risk_cents, profit_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      expect(linha.data?.state).toBe('late')
      expect(linha.data?.value_at_risk_cents).toBe(0)
      expect(linha.data?.profit_at_risk_cents).toBe(0)
    },
    30_000,
  )

  it(
    'assinatura CANCELADA volta a contar venda avulsa normalmente',
    async () => {
      const cliente = await criarCliente('Ex-Assinante Atrasada')
      await inserirAtendimentoConcluido(cliente, 30)

      const plano = await svc
        .from('subscription_plans')
        .insert({ tenant_id: tenantId, name: 'Plano Cancelado do Ciclo', price_cents: 9900, sessions_per_month: 2 })
        .select('id')
        .single()
      await svc.from('client_subscriptions').insert({
        tenant_id: tenantId,
        client_id: cliente,
        plan_id: plano.data!.id,
        billing_day: 5,
        status: 'canceled',
      })

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('value_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      // Mesma conta do teste base (6000 × 0,65 = 3900): cancelada não é ativa, preço volta a valer.
      expect(linha.data?.value_at_risk_cents).toBe(3900)
    },
    30_000,
  )

  it(
    'caminho síncrono (recomputarCicloDeUmAtendimento) também zera para assinante ativo',
    async () => {
      /*
        Chamado direto (não via `concluirAgendamento`) de propósito: concluir sempre torna o
        último visitado "hoje", e daí `computeCycle` prevê a próxima visita no futuro e o estado
        vira SEMPRE `on_track` — que já zera o valor por conta do estado (`PROBABILIDADE_POR_ESTADO.
        on_track = 0`), sem exercitar o desconto do assinante nenhum. Para provar o desconto de
        verdade, precisa do mesmo cenário "atrasado" do teste em lote — 30 dias atrás, ciclo 21.
      */
      const cliente = await criarCliente('Assinante Recalcula na Hora')
      await inserirAtendimentoConcluido(cliente, 30)

      const plano = await svc
        .from('subscription_plans')
        .insert({ tenant_id: tenantId, name: 'Plano Síncrono do Ciclo', price_cents: 9900, sessions_per_month: 2 })
        .select('id')
        .single()
      await svc.from('client_subscriptions').insert({
        tenant_id: tenantId,
        client_id: cliente,
        plan_id: plano.data!.id,
        billing_day: 5,
        status: 'active',
      })

      await recomputarCicloDeUmAtendimento(svc, tenantId, TZ, { clientId: cliente, serviceId: servicoId }, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('state, value_at_risk_cents, profit_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      expect(linha.data?.state).toBe('late')
      expect(linha.data?.value_at_risk_cents).toBe(0)
      expect(linha.data?.profit_at_risk_cents).toBe(0)
    },
    30_000,
  )
})

/**
 * `docs/DECISOES.md` 2026-09-18, achado seguinte ao do clube: pacote com sessão sobrando NESTE
 * serviço também não gera venda avulsa — a próxima visita consome o crédito já pago. Diferente da
 * assinatura (cobre o tenant inteiro), pacote é por (cliente, serviço) — mesma granularidade de
 * `client_cycles`, checagem mais precisa que a do clube.
 */
describe('recomputarCiclosDoTenant — pacote com sessão sobrando', () => {
  it(
    'pacote com sessão sobrando: state continua "late", mas value_at_risk e profit_at_risk zeram',
    async () => {
      const cliente = await criarCliente('Pacote Atrasada')
      await inserirAtendimentoConcluido(cliente, 30) // mesmo cenário do teste base: 30 dias, late

      const { error } = await svc.from('packages').insert({
        tenant_id: tenantId,
        client_id: cliente,
        service_id: servicoId,
        total_sessions: 5,
        used_sessions: 2,
        paid_cents: 25_000,
      })
      if (error) throw error

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('state, value_at_risk_cents, profit_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      expect(linha.data?.state).toBe('late')
      expect(linha.data?.value_at_risk_cents).toBe(0)
      expect(linha.data?.profit_at_risk_cents).toBe(0)
    },
    30_000,
  )

  it(
    'pacote ESGOTADO (sem sessão sobrando) volta a contar venda avulsa normalmente',
    async () => {
      const cliente = await criarCliente('Pacote Esgotado Atrasada')
      await inserirAtendimentoConcluido(cliente, 30)

      const { error } = await svc.from('packages').insert({
        tenant_id: tenantId,
        client_id: cliente,
        service_id: servicoId,
        total_sessions: 5,
        used_sessions: 5,
        paid_cents: 25_000,
      })
      if (error) throw error

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc.from('client_cycles').select('value_at_risk_cents').eq('tenant_id', tenantId).eq('client_id', cliente).single()
      // Mesma conta do teste base (6000 × 0,65 = 3900): esgotado não é "com saldo", preço volta a valer.
      expect(linha.data?.value_at_risk_cents).toBe(3900)
    },
    30_000,
  )

  it(
    'pacote VENCIDO com sessão sobrando volta a contar venda avulsa normalmente',
    async () => {
      const cliente = await criarCliente('Pacote Vencido Atrasada')
      await inserirAtendimentoConcluido(cliente, 30)

      const { error } = await svc.from('packages').insert({
        tenant_id: tenantId,
        client_id: cliente,
        service_id: servicoId,
        total_sessions: 5,
        used_sessions: 1,
        paid_cents: 25_000,
        expires_on: '2020-01-01',
      })
      if (error) throw error

      await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))

      const linha = await svc.from('client_cycles').select('value_at_risk_cents').eq('tenant_id', tenantId).eq('client_id', cliente).single()
      expect(linha.data?.value_at_risk_cents).toBe(3900)
    },
    30_000,
  )

  it(
    'caminho síncrono (recomputarCicloDeUmAtendimento) também zera para pacote com saldo',
    async () => {
      const cliente = await criarCliente('Pacote Recalcula na Hora')
      await inserirAtendimentoConcluido(cliente, 30)

      const { error } = await svc.from('packages').insert({
        tenant_id: tenantId,
        client_id: cliente,
        service_id: servicoId,
        total_sessions: 3,
        used_sessions: 1,
        paid_cents: 15_000,
      })
      if (error) throw error

      await recomputarCicloDeUmAtendimento(svc, tenantId, TZ, { clientId: cliente, serviceId: servicoId }, new Date().toISOString().slice(0, 10))

      const linha = await svc
        .from('client_cycles')
        .select('state, value_at_risk_cents, profit_at_risk_cents')
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
        .single()
      expect(linha.data?.state).toBe('late')
      expect(linha.data?.value_at_risk_cents).toBe(0)
      expect(linha.data?.profit_at_risk_cents).toBe(0)
    },
    30_000,
  )
})

describe('recomputarCiclosDoTenant — performance', () => {
  it(
    '10 mil clientes recalculam em menos de 60s',
    async () => {
      const TOTAL = 10_000
      const clientes = Array.from({ length: TOTAL }, (_, i) => ({ tenant_id: tenantId, name: `Cliente Perf ${i}` }))

      const idsClientes: string[] = []
      for (let inicio = 0; inicio < TOTAL; inicio += 1000) {
        const lote = clientes.slice(inicio, inicio + 1000)
        const { data, error } = await svc.from('clients').insert(lote).select('id')
        if (error) throw error
        idsClientes.push(...data.map((c) => c.id))
      }

      const inicioBase = Date.now() - 15 * 86_400_000
      const agendamentos = idsClientes.map((clientId, i) => ({
        tenant_id: tenantId,
        client_id: clientId,
        professional_id: professionalId,
        service_id: servicoId,
        starts_at: new Date(inicioBase - i * 1000).toISOString(),
        ends_at: new Date(inicioBase - i * 1000 + 3_600_000).toISOString(),
        status: 'done' as const,
        price_cents: 6000,
      }))
      for (let inicio = 0; inicio < agendamentos.length; inicio += 1000) {
        const { error } = await svc.from('appointments').insert(agendamentos.slice(inicio, inicio + 1000))
        if (error) throw error
      }

      const t0 = Date.now()
      const processados = await recomputarCiclosDoTenant(svc, tenantId, TZ, new Date().toISOString().slice(0, 10))
      const duracao = Date.now() - t0

      expect(processados).toBeGreaterThanOrEqual(TOTAL)
      expect(duracao).toBeLessThan(60_000)
    },
    120_000,
  )
})

/**
 * `docs/48` C5 (`I-09`). A guarda do fio inteiro: o recálculo grava em `cycle_predictions`, e a
 * prestação de contas lê de lá. Um teste de unidade prova a aritmética; só o banco prova que a
 * coluna que uma ponta escreve é a que a outra lê — que é exatamente a classe de defeito que a
 * série inteira dos `docs/49` foi consertar.
 */
describe('prestação de contas do Motor', () => {
  it(
    'a previsão registrada pelo recálculo chega na prestação de contas',
    async () => {
      const cliente = await criarCliente('Vai Virar Previsão')
      await inserirAtendimentoConcluido(cliente, 30)

      const hoje = new Date().toISOString().slice(0, 10)
      await recomputarCiclosDoTenant(svc, tenantId, TZ, hoje)

      const { count } = await svc
        .from('cycle_predictions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', cliente)
      expect(count, 'o recálculo não registrou previsão nenhuma — não há o que prestar contas').toBeGreaterThan(0)

      const contas = await prestacaoDeContasDoMotor(svc, tenantId, hoje)
      /*
        A pessoa não voltou e a previsão é recente: fica em ABERTO, não conta como erro. É o outro
        lado do viés de sobrevivência — punir quem ainda pode aparecer amanhã seria o erro oposto.
      */
      expect(contas.emAberto).toBeGreaterThan(0)
      expect(contas.acertoBps, 'com uma amostra dessas o produto não pode afirmar taxa nenhuma').toBeNull()
    },
    60_000,
  )
})

/**
 * `docs/73` F3/T6. O teste de unidade de `medirOscilacaoDaRegua` já prova a aritmética — este
 * prova só a ponta que só o banco prova: que `oscilacaoDaReguaDoTenant` lê `cycle_predictions` de
 * verdade, agrupa por `service_id` e ordena por `predicted_at` antes de medir. As linhas são
 * inseridas direto (não via `recomputarCiclosDoTenant`) de propósito: simular uma régua que MUDOU
 * de verdade entre calibrações exigiria orquestrar vários recálculos com padrões de visita
 * diferentes — o que este teste não precisa provar, só que a leitura está certa.
 */
describe('oscilacaoDaReguaDoTenant', () => {
  it(
    'agrupa por serviço e mede o maior salto entre calibrações sucessivas',
    async () => {
      const cliente = await criarCliente('Vai Virar Ponto de Régua')

      const linhas = [
        { last_visit_on: '2026-01-01', predicted_at: '2026-01-01T03:00:00Z', default_cycle_days: 21 },
        { last_visit_on: '2026-02-01', predicted_at: '2026-02-01T03:00:00Z', default_cycle_days: 21 },
        { last_visit_on: '2026-03-01', predicted_at: '2026-03-01T03:00:00Z', default_cycle_days: 35 }, // salto de 14
        { last_visit_on: '2026-04-01', predicted_at: '2026-04-01T03:00:00Z', default_cycle_days: 21 }, // salto de 14
      ]
      const { error } = await svc.from('cycle_predictions').insert(
        linhas.map((l) => ({
          tenant_id: tenantId,
          client_id: cliente,
          service_id: servicoId,
          last_visit_on: l.last_visit_on,
          predicted_on: l.last_visit_on,
          predicted_at: l.predicted_at,
          personal_cycle_days: l.default_cycle_days,
          default_cycle_days: l.default_cycle_days,
          algo_version: 1,
        })),
      )
      if (error) throw error

      const resultado = await oscilacaoDaReguaDoTenant(svc, tenantId)
      const medida = resultado.get(servicoId)

      expect(medida).toBeDefined()
      expect(medida?.amostras).toBeGreaterThanOrEqual(4)
      expect(medida?.trocas).toBeGreaterThanOrEqual(2)
      expect(medida?.maiorSaltoDias).toBe(14)
    },
    30_000,
  )

  it('serviço sem nenhuma previsão não aparece no mapa — não inventa medida sem amostra', async () => {
    const outroServico = await criarServico(svc, tenantId, {
      name: 'Serviço Sem Previsão do Ciclo',
      description: null,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      priceCents: 3000,
      pricingModel: 'fixed',
      cycleDays: 14,
      depositBps: 0,
      depositMinCents: 0,
      parallelCapacity: 1,
      requiresAnamnesis: false,
      bookableOnline: true,
      categoryId: null,
    })

    const resultado = await oscilacaoDaReguaDoTenant(svc, tenantId)
    expect(resultado.has(outroServico.id)).toBe(false)
  })
})
