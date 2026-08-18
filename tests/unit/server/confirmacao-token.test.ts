import { randomUUID } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { gerarTokenConfirmacao, verificarTokenConfirmacao } from '@/server/services/confirmacao-token'

const ORIGINAL_SECRET = process.env.CRON_SECRET

describe('token de confirmação sem login', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'segredo-de-teste-para-o-hmac'
  })
  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET
    vi.useRealTimers()
  })

  it('gera e verifica, devolvendo o mesmo appointmentId', () => {
    const id = randomUUID()
    const token = gerarTokenConfirmacao(id)
    expect(verificarTokenConfirmacao(token)).toBe(id)
  })

  it('token adulterado (1 caractere trocado) é recusado', () => {
    const token = gerarTokenConfirmacao(randomUUID())
    const adulterado = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    expect(verificarTokenConfirmacao(adulterado)).toBeNull()
  })

  it('token vencido (72h) é recusado', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = gerarTokenConfirmacao(randomUUID())

    vi.setSystemTime(new Date('2026-01-04T01:00:00Z')) // 73h depois
    expect(verificarTokenConfirmacao(token)).toBeNull()
  })

  it('token gerado com uma CRON_SECRET não verifica com outra', () => {
    const token = gerarTokenConfirmacao(randomUUID())
    process.env.CRON_SECRET = 'outro-segredo-completamente-diferente'
    expect(verificarTokenConfirmacao(token)).toBeNull()
  })

  it('lixo aleatório não quebra a verificação, só devolve null', () => {
    expect(verificarTokenConfirmacao('nao-e-um-token-valido')).toBeNull()
    expect(verificarTokenConfirmacao('')).toBeNull()
    expect(verificarTokenConfirmacao('====')).toBeNull()
  })
})
