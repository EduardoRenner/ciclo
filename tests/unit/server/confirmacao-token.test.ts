import { randomUUID } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { gerarTokenConfirmacao, verificarTokenConfirmacao } from '@/server/services/confirmacao-token'

// Segredo passado por parâmetro, nunca por `process.env.CRON_SECRET`: esse
// env var é global do processo, e o Vitest roda arquivos de teste em threads
// que o compartilham — mutar e restaurar aqui vazava para outros arquivos
// rodando em paralelo (lista-espera.test.ts, lembretes.test.ts) que também
// geram/verificam token e dependem do `CRON_SECRET` real.
const SEGREDO = 'segredo-de-teste-para-o-hmac'

describe('token de confirmação sem login', () => {
  it('gera e verifica, devolvendo o mesmo appointmentId', () => {
    const id = randomUUID()
    const token = gerarTokenConfirmacao(id, SEGREDO)
    expect(verificarTokenConfirmacao(token, SEGREDO)).toBe(id)
  })

  it('token adulterado (1 caractere trocado) é recusado', () => {
    // No MEIO do token, não no último caractere: base64url empacota 3 bytes
    // em 4 caracteres, e o último caractere de um grupo pode ter bit "não
    // significativo" que não muda o byte decodificado — trocar ali de vez em
    // quando gera, por acaso, o mesmo payload. No meio, qualquer troca sempre
    // muda um byte de verdade.
    const token = gerarTokenConfirmacao(randomUUID(), SEGREDO)
    const meio = Math.floor(token.length / 2)
    const caractere = token[meio]
    const adulterado = token.slice(0, meio) + (caractere === 'a' ? 'b' : 'a') + token.slice(meio + 1)
    expect(verificarTokenConfirmacao(adulterado, SEGREDO)).toBeNull()
  })

  it('token vencido (72h) é recusado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = gerarTokenConfirmacao(randomUUID(), SEGREDO)

    vi.setSystemTime(new Date('2026-01-04T01:00:00Z')) // 73h depois
    expect(verificarTokenConfirmacao(token, SEGREDO)).toBeNull()
    vi.useRealTimers()
  })

  it('token gerado com um segredo não verifica com outro', () => {
    const token = gerarTokenConfirmacao(randomUUID(), SEGREDO)
    expect(verificarTokenConfirmacao(token, 'outro-segredo-completamente-diferente')).toBeNull()
  })

  it('lixo aleatório não quebra a verificação, só devolve null', () => {
    expect(verificarTokenConfirmacao('nao-e-um-token-valido', SEGREDO)).toBeNull()
    expect(verificarTokenConfirmacao('', SEGREDO)).toBeNull()
    expect(verificarTokenConfirmacao('====', SEGREDO)).toBeNull()
  })
})
