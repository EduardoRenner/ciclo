import { describe, expect, it } from 'vitest'

import { PRECO_MENSAL_CENTS } from '@/core/billing/planos'
import {
  decidirPlano,
  lerAssinatura,
  lerNotificacaoMP,
  valorConfereComDegrau,
  valorMensalEmReais,
} from '@/core/billing/mercado-pago'

/**
 * A lógica pura da assinatura (`docs/55` Fase 1.1). Sem I/O, sem credencial — o que este arquivo
 * guarda é o mapa status-do-MP → degrau e a guarda de valor, que é onde um bug de dinheiro moraria.
 */

describe('decidirPlano: status do Mercado Pago vira decisão sobre tenants.plan', () => {
  it('authorized entrega o degrau contratado, sem graça', () => {
    expect(decidirPlano('authorized', 'equipe', 'gratis')).toEqual({ plano: 'equipe', emGraca: false })
  })

  it('paused mantém o degrau contratado MAS marca emGraca — o MP está retentando', () => {
    // Derrubar o salão no primeiro pagamento que não compensou é a armadilha de "travar no meio
    // do atendimento" um nível acima. A graça existe para o aviso vir antes da queda.
    expect(decidirPlano('paused', 'avancado', 'avancado')).toEqual({ plano: 'avancado', emGraca: true })
  })

  it('pending fica no degrau vigente: assinatura criada e não paga é intenção, não contrato', () => {
    expect(decidirPlano('pending', 'equipe', 'gratis')).toEqual({ plano: 'gratis', emGraca: false })
    expect(decidirPlano('pending', 'equipe', 'essencial')).toEqual({ plano: 'essencial', emGraca: false })
  })

  it('cancelled volta pro grátis, sem graça', () => {
    expect(decidirPlano('cancelled', 'avancado', 'avancado')).toEqual({ plano: 'gratis', emGraca: false })
  })
})

describe('valorConfereComDegrau: a guarda contra checkout adulterado', () => {
  it('aceita o valor exato do catálogo', () => {
    expect(valorConfereComDegrau('essencial', 49)).toBe(true)
    expect(valorConfereComDegrau('equipe', 99)).toBe(true)
    expect(valorConfereComDegrau('avancado', 179)).toBe(true)
  })

  it('tolera 1 centavo de arredondamento do lado do MP, nada além', () => {
    expect(valorConfereComDegrau('essencial', 49.01)).toBe(true)
    expect(valorConfereComDegrau('essencial', 48.99)).toBe(true)
    expect(valorConfereComDegrau('essencial', 48.5)).toBe(false)
  })

  it('recusa o degrau caro por um real — o bug de dinheiro que isto existe para impedir', () => {
    expect(valorConfereComDegrau('avancado', 1)).toBe(false)
    expect(valorConfereComDegrau('equipe', 49)).toBe(false)
  })

  it('o valor em reais deriva do catálogo em centavos, sem número solto', () => {
    expect(valorMensalEmReais('essencial')).toBe(PRECO_MENSAL_CENTS.essencial / 100)
    expect(() => valorMensalEmReais('gratis')).toThrow()
  })
})

describe('lerAssinatura: tenants.settings.assinatura é jsonb livre', () => {
  const boa = {
    provedor: 'mercado_pago',
    preapproval_id: '2c938084xyz',
    plano_contratado: 'equipe',
    status: 'authorized',
    atualizado_em: '2026-09-06T12:00:00.000Z',
  }

  it('lê uma assinatura completa e válida', () => {
    expect(lerAssinatura({ assinatura: boa })?.status).toBe('authorized')
  })

  it('graca_ate e ultimo_evento_id: lidos quando presentes, null quando ausentes', () => {
    expect(lerAssinatura({ assinatura: boa })).toMatchObject({ graca_ate: null, ultimo_evento_id: null })
    const comGraca = { ...boa, status: 'paused', graca_ate: '2026-09-16T00:00:00.000Z', ultimo_evento_id: 'ev-9' }
    expect(lerAssinatura({ assinatura: comGraca })).toMatchObject({ graca_ate: '2026-09-16T00:00:00.000Z', ultimo_evento_id: 'ev-9' })
  })

  it('devolve null para settings sem assinatura, provedor errado, ou status desconhecido', () => {
    expect(lerAssinatura(null)).toBeNull()
    expect(lerAssinatura({})).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, provedor: 'asaas' } })).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, status: 'active' } })).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, preapproval_id: '' } })).toBeNull()
  })
})

describe('lerNotificacaoMP: aceita os dois formatos históricos do webhook', () => {
  it('formato novo: type + data.id', () => {
    expect(lerNotificacaoMP({ type: 'subscription_preapproval', data: { id: 'abc' } })).toEqual({
      assunto: 'subscription',
      id: 'abc',
    })
    expect(lerNotificacaoMP({ type: 'payment', data: { id: '123' } })).toEqual({ assunto: 'payment', id: '123' })
  })

  it('formato antigo: topic + resource como URL', () => {
    expect(lerNotificacaoMP({ topic: 'preapproval', resource: 'https://api.mercadopago.com/preapproval/xyz' })).toEqual({
      assunto: 'subscription',
      id: 'xyz',
    })
  })

  it('devolve null quando não dá para extrair assunto e id — a rota responde 200 e ignora', () => {
    expect(lerNotificacaoMP(null)).toBeNull()
    expect(lerNotificacaoMP({ type: 'plan', data: { id: 'x' } })).toBeNull()
    expect(lerNotificacaoMP({ type: 'payment' })).toBeNull()
  })
})
