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

/**
 * Achado S16 da auditoria de 2026-08-23. A lista original de chaves sensíveis cobria o cofre
 * (`vault`, `anamnese`, `answers`, `ciphertext`) e partia de uma premissa que este produto não
 * cumpre: a de que dado de saúde mora só no cofre.
 *
 * Não mora. `lib/preferencias.ts` põe um campo `alergia` em SEIS das sete verticais, e ele cai em
 * `clients.preferences` — jsonb, em claro, sem MFA e sem trilha de acesso. Qualquer exceção que
 * carregasse um objeto de cliente mandava a alergia inteira para o Sentry, contra a regra 9 do
 * CLAUDE.md, que é literal: "Dado de saúde nunca em log, Sentry ou analytics".
 */
describe('redigirEventoSentry — dado de saúde fora do cofre (achado S16)', () => {
  it('apaga `preferences`, que é onde a alergia de verdade mora neste produto', () => {
    const evento = {
      extra: {
        cliente: {
          id: '00000000-0000-4000-8000-000000000000',
          preferences: { alergia: 'cianoacrilato', curvatura: 'D', maquina: '2' },
        },
      },
    }

    const redigido = redigirEventoSentry(evento)
    expect(redigido.extra.cliente.preferences).toBe('[redigido]')
    // O id não é dado de saúde e continua servindo para o plantão achar o caso.
    expect(redigido.extra.cliente.id).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('apaga anotação livre, que é onde "está grávida" acaba escrito', () => {
    const evento = {
      extra: {
        notes: 'operou semana passada, evitar a área',
        client_note: 'gestante',
        observacao: 'pele sensível a ácido',
        anotacaoDaFicha: 'alergia a PPD',
      },
    }

    const redigido = redigirEventoSentry(evento)
    expect(redigido.extra.notes).toBe('[redigido]')
    expect(redigido.extra.client_note).toBe('[redigido]')
    expect(redigido.extra.observacao).toBe('[redigido]')
    expect(redigido.extra.anotacaoDaFicha).toBe('[redigido]')
  })

  it('cobre as duas grafias — `notes` não contém `nota`, nem o contrário', () => {
    const redigido = redigirEventoSentry({ extra: { notes: 'a', notas: 'b', nota: 'c', client_note: 'd' } })
    expect(Object.values(redigido.extra)).toEqual(['[redigido]', '[redigido]', '[redigido]', '[redigido]'])
  })

  it('apaga campos de sensibilidade e preferência das outras verticais', () => {
    const redigido = redigirEventoSentry({
      extra: { sensibilidade: 'pele muito sensível', preferencias: { ativos: 'retinol' } },
    })
    expect(redigido.extra.sensibilidade).toBe('[redigido]')
    expect(redigido.extra.preferencias).toBe('[redigido]')
  })

  it('não apaga o que o plantão precisa para achar o caso', () => {
    // Redação boa demais é ruim: evento sem nada acionável não serve para nada.
    const redigido = redigirEventoSentry({
      request_id: 'req_abc123',
      transaction: 'GET /api/v1/clients/[id]',
      extra: { tenant_id: '00000000-0000-4000-8000-000000000000', status: 500, notification: 'push enviado' },
    })
    expect(redigido.request_id).toBe('req_abc123')
    expect(redigido.transaction).toBe('GET /api/v1/clients/[id]')
    expect(redigido.extra.status).toBe(500)
    // `notification` não contém 'note' nem 'nota' — não pode virar falso positivo.
    expect(redigido.extra.notification).toBe('push enviado')
  })
})

/**
 * Achado S20 da auditoria de 2026-08-23, encontrado por acidente ao escrever os testes do S16.
 *
 * `PADRAO_TELEFONE` casava 10 a 15 dígitos sem borda nenhuma, e o último grupo de um UUID tem
 * 12 — então `tenant_id` e `client_id` chegavam ao Sentry como `...-8000-[redigido]0`. Quem está
 * de plantão usa exatamente esses ids para achar o caso: redação que apaga o identificador
 * transforma o evento em ruído, e é o caminho mais curto para alguém desligar a redação inteira.
 *
 * O par de testes abaixo é indivisível de propósito — a correção só vale se as DUAS metades
 * valerem. Afrouxar o padrão até o UUID sobreviver é fácil; o difícil é não deixar telefone passar.
 */
describe('redigirEventoSentry — a redação não pode comer identificador (achado S20)', () => {
  it.each([
    '00000000-0000-4000-8000-000000000000',
    '3f2504e0-4f89-41d3-9a0c-030512345678',
    'a1b2c3d4-1111-4222-8333-999988887777',
  ])('UUID %s sobrevive inteiro', (uuid) => {
    const redigido = redigirEventoSentry({ extra: { tenant_id: uuid } })
    expect(redigido.extra.tenant_id).toBe(uuid)
  })

  it('UUID no meio de uma frase de erro também sobrevive', () => {
    const frase = 'agendamento 3f2504e0-4f89-41d3-9a0c-030512345678 sem profissional'
    expect(redigirEventoSentry({ extra: { msg: frase } }).extra.msg).toBe(frase)
  })

  it.each([
    ['cliente +5511999999999 sem horário', '+5511999999999'],
    ['Tel:5511988887777.', '5511988887777'],
    ['ligar para 11988887777 hoje', '11988887777'],
  ])('mas telefone em texto livre continua sendo apagado: %s', (frase, numero) => {
    const saida = redigirEventoSentry({ extra: { msg: frase } }).extra.msg as string
    expect(saida).not.toContain(numero)
    expect(saida).toContain('[redigido]')
  })

  it('CPF em texto livre continua sendo apagado', () => {
    const saida = redigirEventoSentry({ extra: { msg: 'documento 123.456.789-09 inválido' } }).extra.msg as string
    expect(saida).not.toContain('123.456.789-09')
    expect(saida).toContain('[redigido]')
  })

  it('request_id do projeto sobrevive — é o rastro que atravessa proxy e cliente', () => {
    const id = 'req_9f8e7d6c5b4a3928170615243342516a'
    expect(redigirEventoSentry({ extra: { request_id: id } }).extra.request_id).toBe(id)
  })
})
