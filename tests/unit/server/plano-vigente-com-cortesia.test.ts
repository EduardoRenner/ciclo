import { describe, expect, it, vi } from 'vitest'

import { podeCriar, podeUsarModulo, verificarLimite } from '@/core/billing/planos'
import { AppError } from '@/server/http/errors'
import { contextoDePlano, exigirLimite } from '@/server/services/planos'

// Estas regras são as do programa de cortesia e dos degraus: valem com `ACESSO_ABERTO` desligado.
vi.mock('@/core/billing/acesso-aberto', () => ({ ACESSO_ABERTO: false }))

/**
 * `contextoDePlano` é o ÚNICO lugar que lê o plano vigente (docs/87 §3). Aqui o banco é encenação
 * (mesmo motivo de `planos-limite.test.ts`): a regra é pura, e o que se prova é a ligação — que a
 * cortesia guardada em `settings` chega ao contexto, com a expiração decidida pelo `agora` da
 * leitura e não por nada escrito no banco.
 */

const T = '11111111-1111-4111-8111-111111111111'

const D0 = '2027-01-11T03:00:00.000Z' // meia-noite de D0 em Brasília
const CORTESIA = { plano: 'avancado', ate: D0, origem: 'pre_lancamento', concedida_em: '2026-11-20T15:00:00.000Z', fundador: true }

const ANTES_DE_D0 = new Date('2026-12-20T15:00:00Z')
const NA_GRACA = new Date('2027-01-14T15:00:00Z')
const DEPOIS_DA_GRACA = new Date('2027-02-15T15:00:00Z')

function banco(opcoes: { plano: string; cortesia?: unknown; profissionais?: number }) {
  const construtor = (tabela: string) => {
    const encadeavel = {
      select: () => encadeavel,
      eq: () => encadeavel,
      is: () => encadeavel,
      single: async () => ({
        data: {
          plan: opcoes.plano,
          onde: 'no_local',
          cobranca: 'fixo',
          inicio: null,
          ritmo: 'avulso',
          cortesia: opcoes.cortesia ?? null,
        },
        error: null,
      }),
      then: (resolver: (v: unknown) => unknown) =>
        Promise.resolve(
          tabela === 'tenant_modules'
            ? { data: [], error: null }
            : { count: tabela === 'professionals' ? (opcoes.profissionais ?? 0) : 0, error: null },
        ).then(resolver),
    }
    return encadeavel
  }
  return { from: (tabela: string) => construtor(tabela) } as never
}

describe('contextoDePlano com cortesia', () => {
  it('conta grátis com cortesia válida comporta-se como o degrau da cortesia', async () => {
    const ctx = await contextoDePlano(banco({ plano: 'gratis', cortesia: CORTESIA }), T, ANTES_DE_D0)
    expect(ctx.plano).toBe('avancado')
    expect(ctx.planoPago).toBe('gratis')
    expect(ctx.situacao.estado).toBe('cortesia')
    expect(ctx.contaPausada).toBeUndefined()
    // e o que o degrau de cima libera de fato chega: estoque é do Avançado hoje
    expect(podeUsarModulo(ctx, 'stock').estado).toBe('liberado')
  })

  it('sem cortesia a conta grátis segue exatamente como antes', async () => {
    const ctx = await contextoDePlano(banco({ plano: 'gratis' }), T, ANTES_DE_D0)
    expect(ctx.plano).toBe('gratis')
    expect(ctx.situacao.estado).toBe('sem_cortesia')
    expect(podeUsarModulo(ctx, 'stock').estado).toBe('bloqueado_pelo_plano')
  })

  it('cortesia corrompida no jsonb vira "sem cortesia", sem lançar', async () => {
    for (const lixo of ['ate 2027', 42, { plano: 'ouro', ate: D0 }, { ...CORTESIA, ate: 'quando der' }, []]) {
      const ctx = await contextoDePlano(banco({ plano: 'gratis', cortesia: lixo }), T, ANTES_DE_D0)
      expect(ctx.plano, JSON.stringify(lixo)).toBe('gratis')
      expect(ctx.situacao.estado).toBe('sem_cortesia')
    }
  })

  it('quem paga mais que a cortesia não perde nada e não é rebaixado', async () => {
    const equipe = { ...CORTESIA, plano: 'equipe' }
    const ctx = await contextoDePlano(banco({ plano: 'avancado', cortesia: equipe }), T, ANTES_DE_D0)
    expect(ctx.plano).toBe('avancado')
    expect(ctx.situacao.estado).toBe('pago')
  })

  it('quem paga menos que a cortesia leva o degrau da cortesia enquanto ela vale', async () => {
    const ctx = await contextoDePlano(banco({ plano: 'essencial', cortesia: CORTESIA }), T, ANTES_DE_D0)
    expect(ctx.plano).toBe('avancado')
    expect(ctx.planoPago).toBe('essencial')
  })

  it('na graça tudo funciona: degrau da cortesia e sem trava de criar', async () => {
    const ctx = await contextoDePlano(banco({ plano: 'gratis', cortesia: CORTESIA }), T, NA_GRACA)
    expect(ctx.situacao.estado).toBe('graca')
    expect(ctx.plano).toBe('avancado')
    expect(ctx.contaPausada).toBeUndefined()
    expect(podeCriar(ctx, 'clientes', 10)).toBe(true)
  })
})

describe('a conta pausada (docs/87 D1)', () => {
  it('não cria nada, mas continua ENXERGANDO o que o degrau da cortesia liberava', async () => {
    const ctx = await contextoDePlano(banco({ plano: 'gratis', cortesia: CORTESIA }), T, DEPOIS_DA_GRACA)
    expect(ctx.situacao.estado).toBe('pausada')
    expect(ctx.contaPausada).toBe(true)
    // regra 5.1: a tela de estoque não vira "bloqueada, assine o Avançado" para quem já tem estoque
    expect(podeUsarModulo(ctx, 'stock').estado).toBe('liberado')
    // mas não cria: nem o recurso de teto duro, nem o de teto suave
    expect(podeCriar(ctx, 'profissionais', 0)).toBe(false)
    expect(podeCriar(ctx, 'clientes', 0)).toBe(false)
  })

  it('exigirLimite recusa com PLAN_LIMIT e marca `contaPausada`, mesmo sobrando vaga', async () => {
    // `exigirLimite` lê o relógio real, então a cortesia daqui é uma que venceu há muito tempo
    const vencida = { ...CORTESIA, ate: '2026-01-01T03:00:00.000Z' }
    const erro = await exigirLimite(banco({ plano: 'gratis', cortesia: vencida, profissionais: 0 }), T, 'profissionais').then(
      () => null,
      (e: unknown) => e,
    )
    expect(erro).toBeInstanceOf(AppError)
    expect((erro as AppError).code).toBe('PLAN_LIMIT')
    expect((erro as AppError).details).toEqual({ contaPausada: true })
  })

  it('assinar reativa na hora, sem esperar cron nem escrita: o mesmo banco, agora com plano pago', async () => {
    const pausada = await contextoDePlano(banco({ plano: 'gratis', cortesia: CORTESIA }), T, DEPOIS_DA_GRACA)
    expect(pausada.contaPausada).toBe(true)
    const pago = await contextoDePlano(banco({ plano: 'essencial', cortesia: CORTESIA }), T, DEPOIS_DA_GRACA)
    expect(pago.contaPausada).toBeUndefined()
    expect(pago.plano).toBe('essencial')
    expect(verificarLimite(pago, 'profissionais', 0).dentro).toBe(true)
  })
})
