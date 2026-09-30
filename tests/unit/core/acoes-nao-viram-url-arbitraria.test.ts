import { describe, expect, it } from 'vitest'

import { acaoTemVolta, linkDaChamada, rotaDaAcao, textoDeFeito } from '@/core/assistente/acoes'

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

describe('o texto depois do toque diz o que aconteceu', () => {
  it('cada ação com a sua palavra — "Marcado." era dito até para anotação e cadastro', async () => {
    const { textoDeFeito } = await import('@/core/assistente/acoes')
    expect(textoDeFeito('criar_agendamento')).toBe('Marcado.')
    expect(textoDeFeito('adicionar_nota')).toBe('Anotação salva.')
    expect(textoDeFeito('cadastrar_cliente')).toBe('Cadastro feito.')
    expect(textoDeFeito('adicionar_item_comanda')).toBe('Lançado na comanda.')
    expect(textoDeFeito('concluir_atendimento')).toBe('Atendimento concluído.')
    expect(textoDeFeito('acao_nova_qualquer')).toBe('Feito.')
  })
})

describe('chamar de volta (docs/84 P2): o destino é wa.me e só', () => {
  const MSG = 'Oi, Carla! Faz um tempinho desde seu último horário de corte. Quer marcar essa semana?'

  it('com telefone E.164: conversa endereçada, texto codificado', () => {
    expect(linkDaChamada({ telefone: '+5511987654321', mensagem: MSG })).toBe(`https://wa.me/5511987654321?text=${encodeURIComponent(MSG)}`)
  })

  it('sem telefone salvo: o seletor de contato do próprio WhatsApp', () => {
    expect(linkDaChamada({ telefone: null, mensagem: MSG })).toBe(`https://wa.me/?text=${encodeURIComponent(MSG)}`)
  })

  it('telefone fora do formato NÃO vira destino — nem outro host, nem caminho', () => {
    for (const perigoso of ['5511987654321', '+55 11 98765-4321', '+5511987654321/../evil', '+5511987654321@evil.example', 'https://evil.example', '+0123456789', 42, {}]) {
      expect(linkDaChamada({ telefone: perigoso, mensagem: MSG }), `passou: ${String(perigoso)}`).toBeNull()
    }
  })

  it('o texto vai CODIFICADO: não fecha o parâmetro nem abre outro', () => {
    const link = linkDaChamada({ telefone: '+5511987654321', mensagem: 'oi&phone=5599999999999#x' })!
    expect(new URL(link).searchParams.get('phone')).toBeNull()
    expect(new URL(link).searchParams.get('text')).toBe('oi&phone=5599999999999#x')
  })

  it('sem texto, ou texto enorme, não vira botão', () => {
    expect(linkDaChamada({ telefone: '+5511987654321', mensagem: '' })).toBeNull()
    expect(linkDaChamada({ telefone: '+5511987654321' })).toBeNull()
    expect(linkDaChamada({ telefone: '+5511987654321', mensagem: 'x'.repeat(1001) })).toBeNull()
  })

  it('a rota só existe com ids que são UUID', () => {
    expect(rotaDaAcao('chamar_de_volta', { clientId: UUID_OK, serviceId: UUID_OK })).toBe('/api/v1/cycle/recover/manual')
    expect(rotaDaAcao('chamar_de_volta', { clientId: UUID_OK })).toBe('/api/v1/cycle/recover/manual')
    expect(rotaDaAcao('chamar_de_volta', { clientId: 'x' })).toBeNull()
    expect(rotaDaAcao('chamar_de_volta', { clientId: UUID_OK, serviceId: '../x' })).toBeNull()
  })

  it('200 sem ter anotado não diz "anotada"', () => {
    expect(textoDeFeito('chamar_de_volta', { registrada: true })).toBe('Chamada anotada. Se marcar, a volta conta para o Motor de Ciclo.')
    expect(textoDeFeito('chamar_de_volta', { registrada: false, motivo: 'ja_chamada' })).toBe('Já estava anotada nesta semana. A mensagem abre do mesmo jeito.')
    expect(textoDeFeito('chamar_de_volta', { registrada: false, motivo: 'sem_ciclo' })).toMatch(/não conta para o Motor de Ciclo/)
    expect(textoDeFeito('chamar_de_volta', { registrada: false, motivo: 'novo' })).toBe('A mensagem abre, mas a chamada não foi anotada.')
  })
})
