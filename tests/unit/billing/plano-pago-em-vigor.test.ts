import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { semComentarios } from '../../helpers/fonte'

import { planoPagoEmVigor } from '@/core/billing/mercado-pago'

/**
 * APR-027b (C-06): o degrau pago cai na hora que a graça vence, lido a cada acesso — sem esperar o
 * cron `expirar-graca`, que ficou sem gatilho. O caso "pago em dia" é obrigatório: um erro aqui
 * derruba plano de quem pagou.
 */
const agora = new Date('2026-11-10T12:00:00Z')
const ontem = '2026-11-09T12:00:00Z'
const amanha = '2026-11-11T12:00:00Z'

describe('planoPagoEmVigor (APR-027b)', () => {
  it('pago em dia: continua no degrau', () => {
    expect(planoPagoEmVigor('equipe', { status: 'authorized', graca_ate: null, acesso_ate: null }, agora)).toBe('equipe')
  })

  it('graça vigente: continua no degrau', () => {
    expect(planoPagoEmVigor('equipe', { status: 'paused', graca_ate: amanha, acesso_ate: null }, agora)).toBe('equipe')
  })

  it('graça vencida: cai para o Grátis sem ninguém gravar nada', () => {
    expect(planoPagoEmVigor('equipe', { status: 'paused', graca_ate: ontem, acesso_ate: null }, agora)).toBe('gratis')
    expect(planoPagoEmVigor('equipe', { status: 'paused', graca_ate: agora.toISOString(), acesso_ate: null }, agora)).toBe('gratis')
  })

  it('pausada com `graca_ate` nulo ou ilegível: não derruba (mesma conduta do cron)', () => {
    expect(planoPagoEmVigor('equipe', { status: 'paused', graca_ate: null, acesso_ate: null }, agora)).toBe('equipe')
    expect(planoPagoEmVigor('equipe', { status: 'paused', graca_ate: 'lixo', acesso_ate: null }, agora)).toBe('equipe')
  })

  it('cancelada: fica até o fim do período pago e cai depois', () => {
    expect(planoPagoEmVigor('avancado', { status: 'cancelled', graca_ate: null, acesso_ate: amanha }, agora)).toBe('avancado')
    expect(planoPagoEmVigor('avancado', { status: 'cancelled', graca_ate: null, acesso_ate: ontem }, agora)).toBe('gratis')
  })

  it('sem assinatura (plano dado à mão, ou nunca assinou): o `tenants.plan` vale como está', () => {
    expect(planoPagoEmVigor('essencial', null, agora)).toBe('essencial')
    expect(planoPagoEmVigor('gratis', null, agora)).toBe('gratis')
  })

  it('`graca_ate` velha numa assinatura que voltou a pagar não derruba', () => {
    expect(planoPagoEmVigor('equipe', { status: 'authorized', graca_ate: ontem, acesso_ate: ontem }, agora)).toBe('equipe')
  })
})

describe('quem lê `tenants.plan` para decidir acesso passa pela graça (APR-027b)', () => {
  it('o contexto do painel (faixa e trava da pausa) traz a assinatura e aplica a graça', () => {
    const tenant = semComentarios(readFileSync('src/server/auth/tenant.ts', 'utf8'))
    expect(tenant).toMatch(/\.select\([^)]*, plan, cortesia:settings->cortesia, assinatura:settings->assinatura, [^)]*\)/)
    expect(tenant).toMatch(/plan: planoPagoDoTenant\(bruto\.plan, \{ assinatura: bruto\.assinatura \}\)/)
  })

  it('o selo da página pública segue o degrau em vigor', () => {
    const publica = semComentarios(readFileSync('src/server/services/public-booking.ts', 'utf8'))
    expect(publica).toMatch(/plano: planoPagoDoTenant\(tenant\.plan, tenant\.settings\)/)
    expect(publica).not.toMatch(/normalizarPlano\(/)
  })
})
