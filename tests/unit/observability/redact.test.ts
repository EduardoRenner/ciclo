import { describe, expect, it } from 'vitest'

import { redigirEventoSentry } from '@/lib/observability/redact'

describe('redigirEventoSentry', () => {
  it('apaga campo por chave sensível, em qualquer profundidade, e nunca muta o evento original', () => {
    const evento = {
      user: { email: 'cliente@exemplo.com', ip_address: '203.0.113.5' },
      request: {
        headers: { authorization: 'Bearer sk_live_abc123', cookie: 'ciclo_tenant=abc; sb-token=xyz' },
        data: { phone_e164: '+5511988887777' },
      },
      extra: {
        anamnese: { answers: { alergia: 'penicilina — grave' } },
        vault: { ciphertext: '\\xdeadbeef', iv: '\\xcafe', authTag: '\\xbeef' },
      },
      breadcrumbs: [{ category: 'fetch', data: { token: 'segredo-de-sessao' } }],
    }

    const redigido = redigirEventoSentry(evento)

    expect(redigido.user.email).toBe('[redigido]')
    expect(redigido.request.headers.authorization).toBe('[redigido]')
    expect(redigido.request.headers.cookie).toBe('[redigido]')
    expect(redigido.request.data.phone_e164).toBe('[redigido]')
    // A própria chave `anamnese` já é sensível — o objeto inteiro some, não só `.answers` dentro dele.
    expect(redigido.extra.anamnese).toBe('[redigido]')
    // Mesma coisa para `vault` — a chave-pai já basta.
    expect(redigido.extra.vault).toBe('[redigido]')
    expect(redigido.breadcrumbs[0]?.data.token).toBe('[redigido]')

    // Original intocado — é cópia, não mutação in-place.
    expect(evento.user.email).toBe('cliente@exemplo.com')
    expect(evento.request.headers.authorization).toBe('Bearer sk_live_abc123')
  })

  it('redige telefone, e-mail e CPF soltos dentro de texto livre, mesmo sem chave sensível', () => {
    const evento = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Falha ao notificar +5511988887777 (cliente@exemplo.com, CPF 123.456.789-01) — tente de novo',
          },
        ],
      },
    }

    const redigido = redigirEventoSentry(evento)
    const mensagem = redigido.exception.values[0]?.value ?? ''

    expect(mensagem).not.toMatch(/\+5511988887777/)
    expect(mensagem).not.toMatch(/cliente@exemplo\.com/)
    expect(mensagem).not.toMatch(/123\.456\.789-01/)
    expect(mensagem).toContain('Falha ao notificar')
    expect(mensagem).toContain('tente de novo')
  })

  it('não mexe em campo isento mesmo com dígitos longos (trace_id, timestamp, release) e preserva mensagem sem PII', () => {
    const evento = {
      event_id: 'a1b2c3d4e5f60000111122223333444455556666',
      trace_id: '1234567890123456789012345678901',
      release: 'ciclo@0.1.0+1755550800',
      level: 'error',
      message: 'Agendamento não encontrado',
    }

    const redigido = redigirEventoSentry(evento)

    expect(redigido.trace_id).toBe(evento.trace_id)
    expect(redigido.release).toBe(evento.release)
    expect(redigido.event_id).toBe(evento.event_id)
    expect(redigido.message).toBe('Agendamento não encontrado')
  })

  it('estrutura profunda demais não derruba a função — devolve sem estourar pilha', () => {
    type No = { proximo?: No; segredo?: string }
    const raiz: No = {}
    let atual = raiz
    for (let i = 0; i < 50; i++) {
      atual.proximo = {}
      atual = atual.proximo
    }
    atual.segredo = 'nao deveria vazar mas a guarda de profundidade para antes'

    expect(() => redigirEventoSentry({ raiz })).not.toThrow()
  })
})
