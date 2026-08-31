import { describe, expect, it } from 'vitest'

import { acaoTemVolta, rotaDaAcao } from '@/core/assistente/acoes'

/**
 * A proposta nasce de um objeto que passou pelo MODELO, e o modelo lê nome de cliente — campo que
 * o cliente final preenche no agendamento público (`docs/26 §4.3`). Se a tela aceitasse uma URL
 * vinda dali, o destino da requisição seria influenciável por texto de terceiro. Por isso o
 * formato da URL é fixo no código e da proposta vem só o id, validado como UUID.
 */
const UUID_OK = '0f47d61d-c7b8-4a0c-8a08-8bb68f530fbe'

describe('rotaDaAcao', () => {
  it('monta a rota das ações conhecidas', () => {
    expect(rotaDaAcao('criar_agendamento', {})).toBe('/api/v1/appointments')
    expect(rotaDaAcao('concluir_atendimento', { appointmentId: UUID_OK })).toBe(`/api/v1/appointments/${UUID_OK}/complete`)
  })

  it('ação desconhecida não vira rota — botão sem destino não dispara', () => {
    expect(rotaDaAcao('apagar_tudo', { id: UUID_OK })).toBeNull()
    expect(rotaDaAcao('', {})).toBeNull()
  })

  it('id que não é UUID NUNCA entra na URL', () => {
    // O ataque que isto fecha: travessia de caminho saindo da rota pretendida. Cada um destes,
    // interpolado sem validação, mandaria o POST para outro lugar.
    for (const perigoso of [
      '../../../admin/config',
      `${UUID_OK}/../../../outra-coisa`,
      'x?redirect=https://evil.example',
      '..%2F..%2Fadmin',
      '',
      null,
      undefined,
      42,
      { toString: () => UUID_OK },
    ]) {
      expect(rotaDaAcao('concluir_atendimento', { appointmentId: perigoso }), `passou: ${String(perigoso)}`).toBeNull()
    }
  })

  it('id ausente não vira rota com "undefined" no meio', () => {
    expect(rotaDaAcao('concluir_atendimento', {})).toBeNull()
  })
})

describe('acaoTemVolta', () => {
  it('concluir atendimento é marcada como sem volta — o cartão precisa avisar', () => {
    // `done` é estado terminal em `core/scheduling/state.ts` (`done: new Set([])`), e concluir
    // abre comanda e credita pontos. Se alguém tirar daqui, o aviso some da tela em silêncio.
    expect(acaoTemVolta('concluir_atendimento')).toBe(false)
  })

  it('ação reversível não recebe aviso — senão o aviso vira ruído e ninguém lê', () => {
    expect(acaoTemVolta('criar_agendamento')).toBe(true)
    expect(acaoTemVolta('adicionar_nota')).toBe(true)
  })
})
