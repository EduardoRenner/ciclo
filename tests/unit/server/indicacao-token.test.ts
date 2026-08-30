import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { gerarTokenIndicacao, verificarTokenIndicacao } from '@/server/services/indicacao'
import { gerarTokenAvaliacao, verificarTokenAvaliacao } from '@/server/services/avaliacoes'

// Segredo por parâmetro, nunca `process.env.CRON_SECRET` — mesma regra de `confirmacao-token.test.ts`:
// arquivos de teste rodam em threads que compartilham `process.env`.
const SEGREDO = 'segredo-de-teste-para-o-hmac'

describe('token de indicação (I-1, docs/30-INDICACAO-PLANO.md)', () => {
  it('gera e verifica, devolvendo o mesmo clientId de quem indicou', () => {
    const clientId = randomUUID()
    const token = gerarTokenIndicacao(clientId, SEGREDO)
    expect(verificarTokenIndicacao(token, SEGREDO)).toBe(clientId)
  })

  it('token adulterado é recusado', () => {
    const token = gerarTokenIndicacao(randomUUID(), SEGREDO)
    const meio = Math.floor(token.length / 2)
    const caractere = token[meio]
    const adulterado = token.slice(0, meio) + (caractere === 'a' ? 'b' : 'a') + token.slice(meio + 1)
    expect(verificarTokenIndicacao(adulterado, SEGREDO)).toBeNull()
  })

  it('sobrevive a seis meses e vence no sétimo — a validade é de 180 dias, não de horas', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = gerarTokenIndicacao(randomUUID(), SEGREDO)

    vi.setSystemTime(new Date('2026-06-01T00:00:00Z')) // 151 dias — ainda dentro
    expect(verificarTokenIndicacao(token, SEGREDO)).not.toBeNull()

    vi.setSystemTime(new Date('2026-07-15T00:00:00Z')) // 195 dias — venceu
    expect(verificarTokenIndicacao(token, SEGREDO)).toBeNull()
    vi.useRealTimers()
  })

  /**
   * O escopo é o que impede um token de avaliação (que a cliente já tem em mãos, porque acabou
   * de usá-lo para chegar na tela) de ser aceito como convite de indicação — mesmo mecanismo que
   * já separa confirmação de lista de espera. Sem isto, qualquer link de avaliação em circulação
   * seria também um link de indicação válido, atribuído ao `appointmentId` em vez de a um
   * `client_id` — dado errado indo para `referred_by`.
   */
  it('um token de AVALIAÇÃO não vale como token de INDICAÇÃO, mesmo com o mesmo segredo', () => {
    const id = randomUUID()
    const tokenDeAvaliacao = gerarTokenAvaliacao(id, SEGREDO)
    expect(verificarTokenIndicacao(tokenDeAvaliacao, SEGREDO)).toBeNull()

    const tokenDeIndicacao = gerarTokenIndicacao(id, SEGREDO)
    expect(verificarTokenAvaliacao(tokenDeIndicacao, SEGREDO)).toBeNull()
  })
})
