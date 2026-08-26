import { randomUUID } from 'node:crypto'

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { criarCliente } from '@/server/services/clientes'
import { concluirAgendamento } from '@/server/services/agendamentos'
import {
  dadosParaAvaliar,
  gerarTokenAvaliacao,
  registrarAvaliacao,
  resumoAvaliacoes,
  verificarTokenAvaliacao,
} from '@/server/services/avaliacoes'
import { centralDeAcoes } from '@/server/services/crm'
import { atualizarConfigFidelidade, extratoDePontos } from '@/server/services/fidelidade'
import { executarOnboarding } from '@/server/services/onboarding'
import { criarProfissional } from '@/server/services/profissionais'
import { criarServico } from '@/server/services/servicos'

import type { Database } from '@/server/db/types.gen'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')

const svc = createClient<Database>(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

let tenantId: string
let userId: string
let servicoId: string
let profissionalId: string
let padrinhoId: string
let afilhadoId: string

/** Insere direto em `arrived` — a máquina de estado só permite `done` a partir dali; testar a
 *  automação não precisa repetir a jornada inteira `pending → confirmed → arrived`. */
async function criarAgendamentoArrived(clientId: string, priceCents: number) {
  const inicio = new Date(Date.now() - 30 * 60_000)
  const { data, error } = await svc
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      professional_id: profissionalId,
      service_id: servicoId,
      starts_at: inicio.toISOString(),
      ends_at: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
      status: 'arrived',
      price_cents: priceCents,
      arrived_at: inicio.toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`seed de agendamento falhou: ${error.message}`)
  return data.id
}

beforeAll(async () => {
  const marca = randomUUID().slice(0, 8)
  const { data, error } = await svc.auth.admin.createUser({
    email: `crm-inova-${marca}@ciclo.test`,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: 'Dono do Teste' },
  })
  if (error || !data.user) throw new Error(`seed falhou: ${error?.message}`)
  userId = data.user.id

  const { tenant } = await executarOnboarding(svc, {
    userId,
    businessName: 'Salão de Inovação',
    vertical: 'barber',
    slug: `crm-inova-${marca}`,
    timezone: 'America/Sao_Paulo',
  })
  tenantId = tenant.id

  /*
   * Fidelidade é vendida no degrau Equipe (R$ 99), e desde 2026-08-26 a automação confere isso no
   * servidor — `pontuarAtendimentoConcluido` não credita nada para tenant `gratis`, que é o plano
   * com que todo onboarding nasce.
   *
   * Este arquivo testa o MECANISMO da automação (pontuar sozinho ao concluir, bônus de indicação
   * nos dois lados), não a regra de plano — então o fixture declara o degrau que compra o recurso.
   * A regra de plano em si tem teste próprio e unitário em
   * `tests/unit/server/fidelidade-automacao.test.ts`, inclusive o caso do `gratis` que NÃO pontua.
   */
  const { error: erroPlano } = await svc.from('tenants').update({ plan: 'equipe' }).eq('id', tenantId)
  if (erroPlano) throw new Error(`não consegui pôr o tenant no plano equipe: ${erroPlano.message}`)

  const profissional = await criarProfissional(svc, tenantId, {
    displayName: 'Profissional',
    compModel: 'owner',
    commissionBps: 0,
    rentCents: 0,
    acceptsOnline: true,
  })
  profissionalId = profissional.id

  const servico = await criarServico(svc, tenantId, {
    name: 'Corte de Teste de Inovação',
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
  servicoId = servico.id

  const padrinho = await criarCliente(svc, tenantId, { name: 'Padrinho', phone: '11977770001', tags: [], marketingOptIn: true })
  padrinhoId = padrinho.id
  const afilhado = await criarCliente(svc, tenantId, { name: 'Afilhado', phone: '11977770002', tags: [], marketingOptIn: true })
  afilhadoId = afilhado.id
  await svc.from('clients').update({ referred_by: padrinhoId }).eq('id', afilhadoId)
}, 90_000)

/** Tenants/usuários criados por um teste específico, além do par do `beforeAll`. */
const tenants: string[] = []
const usuarios: string[] = []

afterAll(async () => {
  await svc.from('tenants').delete().eq('id', tenantId)
  await svc.auth.admin.deleteUser(userId)
  for (const t of tenants) await svc.from('tenants').delete().eq('id', t)
  for (const u of usuarios) await svc.auth.admin.deleteUser(u)
}, 60_000)

describe('fidelidade automática', () => {
  it(
    'concluir um atendimento credita pontos sozinho, sem ninguém lançar na mão',
    async () => {
      await atualizarConfigFidelidade(svc, tenantId, {
        pointsPerReal: 2,
        referralBonusPoints: 0,
        rewardThreshold: 100,
        rewardLabel: null,
      })

      const clienteAvulso = await criarCliente(svc, tenantId, { name: 'Cliente Avulso', tags: [], marketingOptIn: false })
      const agendamentoId = await criarAgendamentoArrived(clienteAvulso.id, 5_000)
      await concluirAgendamento(svc, tenantId, agendamentoId)

      // R$ 50,00 × 2 pontos/real = 100 pontos, sem ninguém ter chamado `lancarPontos`.
      const extrato = await extratoDePontos(svc, tenantId, clienteAvulso.id)
      expect(extrato.saldo).toBe(100)
      expect(extrato.lancamentos[0]).toMatchObject({ reason: 'Pontos do atendimento', points: 100 })
    },
    30_000,
  )

  it(
    'pointsPerReal em 0 desliga a pontuação — negócio que não quer fidelidade não é forçado',
    async () => {
      await atualizarConfigFidelidade(svc, tenantId, {
        pointsPerReal: 0,
        referralBonusPoints: 0,
        rewardThreshold: 100,
        rewardLabel: null,
      })

      const cliente = await criarCliente(svc, tenantId, { name: 'Cliente Sem Fidelidade', tags: [], marketingOptIn: false })
      const agendamentoId = await criarAgendamentoArrived(cliente.id, 5_000)
      await concluirAgendamento(svc, tenantId, agendamentoId)

      expect((await extratoDePontos(svc, tenantId, cliente.id)).saldo).toBe(0)
    },
    30_000,
  )

  it(
    'bônus de indicação credita os dois lados só na primeira visita concluída do indicado',
    async () => {
      await atualizarConfigFidelidade(svc, tenantId, {
        pointsPerReal: 0,
        referralBonusPoints: 30,
        rewardThreshold: 100,
        rewardLabel: null,
      })

      const primeiro = await criarAgendamentoArrived(afilhadoId, 5_000)
      await concluirAgendamento(svc, tenantId, primeiro)

      expect((await extratoDePontos(svc, tenantId, padrinhoId)).saldo).toBe(30)
      expect((await extratoDePontos(svc, tenantId, afilhadoId)).saldo).toBe(30)

      // Segunda visita do mesmo afilhado: já não é mais "primeira visita" — sem bônus de novo.
      await svc.from('clients').update({ visits_count: 1 }).eq('id', afilhadoId)
      const segundo = await criarAgendamentoArrived(afilhadoId, 5_000)
      await concluirAgendamento(svc, tenantId, segundo)

      expect((await extratoDePontos(svc, tenantId, padrinhoId)).saldo).toBe(30)
      expect((await extratoDePontos(svc, tenantId, afilhadoId)).saldo).toBe(30)
    },
    30_000,
  )
})

describe('avaliação pós-atendimento', () => {
  it(
    'token assinado prova o agendamento sem precisar de sessão nenhuma',
    async () => {
      const agendamentoId = await criarAgendamentoArrived(padrinhoId, 5_000)
      await concluirAgendamento(svc, tenantId, agendamentoId)

      const token = gerarTokenAvaliacao(agendamentoId)
      expect(verificarTokenAvaliacao(token)).toBe(agendamentoId)
      expect(verificarTokenAvaliacao('token-forjado')).toBeNull()

      const dados = await dadosParaAvaliar(svc, agendamentoId)
      expect(dados).toMatchObject({ negocioNome: 'Salão de Inovação', servicoNome: 'Corte de Teste de Inovação', jaAvaliado: false })
    },
    30_000,
  )

  it(
    'registrar duas vezes o mesmo agendamento não duplica nem quebra — responde como sucesso',
    async () => {
      const agendamentoId = await criarAgendamentoArrived(padrinhoId, 5_000)
      await concluirAgendamento(svc, tenantId, agendamentoId)

      await registrarAvaliacao(svc, agendamentoId, { rating: 5, comment: 'Excelente!' })
      const segunda = await registrarAvaliacao(svc, agendamentoId, { rating: 1, comment: 'mudei de ideia' })
      expect(segunda).toMatchObject({ duplicado: true })

      const { data } = await svc.from('client_reviews').select('rating').eq('appointment_id', agendamentoId)
      expect(data).toHaveLength(1)
      expect(data![0]!.rating).toBe(5)
    },
    30_000,
  )

  it(
    'resumoAvaliacoes calcula média e distribuição do tenant inteiro',
    async () => {
      const resumo = await resumoAvaliacoes(svc, tenantId)
      expect(resumo.total).toBeGreaterThan(0)
      expect(resumo.media).not.toBeNull()
      expect(resumo.distribuicao[5]).toBeGreaterThan(0)
    },
    30_000,
  )
})

describe('central de ações', () => {
  it(
    'nunca lança — tenant sem nada notável devolve lista, não erro',
    async () => {
      const { acoes } = await centralDeAcoes(svc, tenantId)
      expect(Array.isArray(acoes)).toBe(true)
    },
    30_000,
  )

  it(
    'conta sem cliente e sem agendamento recebe os primeiros passos, não uma tela muda',
    async () => {
      const marca = randomUUID().slice(0, 8)
      const { data: usuario, error } = await svc.auth.admin.createUser({
        email: `primeiros-passos-${marca}@ciclo.test`,
        password: randomUUID(),
        email_confirm: true,
      })
      if (error || !usuario.user) throw new Error(`seed falhou: ${error?.message}`)
      usuarios.push(usuario.user.id)

      const { tenant } = await executarOnboarding(svc, {
        userId: usuario.user.id,
        businessName: 'Salão Recém-Nascido',
        vertical: 'barber',
        slug: `primeiros-passos-${marca}`,
        timezone: 'America/Sao_Paulo',
      })
      tenants.push(tenant.id)

      const central = await centralDeAcoes(svc, tenant.id)
      expect(central.titulo).toBe('Primeiros passos')
      expect(central.acoes.map((a) => a.chave)).toContain('inicio-agenda')
    },
    60_000,
  )
})
