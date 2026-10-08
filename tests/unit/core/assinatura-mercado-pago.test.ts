import { describe, expect, it } from 'vitest'

import { PRECO_MENSAL_CENTS } from '@/core/billing/planos'
import {
  acessoPagoVigente,
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

  it('cancelled com período pago correndo MANTÉM o degrau contratado (Termos §6, C7)', () => {
    expect(decidirPlano('cancelled', 'equipe', 'equipe', true)).toEqual({ plano: 'equipe', emGraca: false })
    // O contratado, e não o vigente: o webhook pode chegar depois de a tela ter mudado o vigente.
    expect(decidirPlano('cancelled', 'equipe', 'essencial', true)).toEqual({ plano: 'equipe', emGraca: false })
  })

  it('cancelled sem período pago correndo cai na hora, e o padrão do 4º argumento é "não corre"', () => {
    expect(decidirPlano('cancelled', 'equipe', 'equipe', false)).toEqual({ plano: 'gratis', emGraca: false })
    expect(decidirPlano('cancelled', 'equipe', 'equipe')).toEqual({ plano: 'gratis', emGraca: false })
  })
})

describe('acessoPagoVigente: o período já pago de quem cancelou', () => {
  const agora = new Date('2026-11-10T12:00:00Z')
  const cancelada = (acesso_ate: string | null | undefined) => ({ status: 'cancelled' as const, acesso_ate })

  it('vale até a data e acaba nela (a data é exclusiva)', () => {
    expect(acessoPagoVigente(cancelada('2026-11-20T03:00:00Z'), agora)).toBe(true)
    expect(acessoPagoVigente(cancelada('2026-11-10T12:00:00Z'), agora)).toBe(false)
    expect(acessoPagoVigente(cancelada('2026-11-01T03:00:00Z'), agora)).toBe(false)
  })

  it('sem data, sem assinatura, ou com data lixo: não há período pago correndo', () => {
    expect(acessoPagoVigente(cancelada(null), agora)).toBe(false)
    expect(acessoPagoVigente(cancelada(undefined), agora)).toBe(false)
    expect(acessoPagoVigente(null, agora)).toBe(false)
    expect(acessoPagoVigente(cancelada('isto não é uma data'), agora)).toBe(false)
  })

  it('só a assinatura CANCELADA tem período pago a correr: authorized e paused não são afetadas pela data', () => {
    expect(acessoPagoVigente({ status: 'authorized', acesso_ate: '2026-11-20T03:00:00Z' }, agora)).toBe(false)
    expect(acessoPagoVigente({ status: 'paused', acesso_ate: '2026-11-20T03:00:00Z' }, agora)).toBe(false)
  })

  it('lerAssinatura lê acesso_ate, e ignora o que não é texto', () => {
    const base = { provedor: 'mercado_pago', preapproval_id: 'p', plano_contratado: 'equipe', status: 'cancelled', atualizado_em: '2026-11-01T00:00:00Z' }
    expect(lerAssinatura({ assinatura: { ...base, acesso_ate: '2026-11-20T03:00:00Z' } })?.acesso_ate).toBe('2026-11-20T03:00:00Z')
    expect(lerAssinatura({ assinatura: { ...base, acesso_ate: 42 } })?.acesso_ate).toBeNull()
    expect(lerAssinatura({ assinatura: base })?.acesso_ate).toBeNull()
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

  it('devolve null para settings sem assinatura, provedor errado, ou status desconhecido', () => {
    expect(lerAssinatura(null)).toBeNull()
    expect(lerAssinatura({})).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, provedor: 'asaas' } })).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, status: 'active' } })).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, preapproval_id: '' } })).toBeNull()
  })

  it('graca_ate é opcional: null quando ausente, lido quando presente', () => {
    expect(lerAssinatura({ assinatura: boa })?.graca_ate).toBeNull()
    expect(lerAssinatura({ assinatura: { ...boa, graca_ate: '2026-09-20T00:00:00.000Z' } })?.graca_ate).toBe(
      '2026-09-20T00:00:00.000Z',
    )
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
