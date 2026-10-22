import { describe, expect, it, vi } from 'vitest'

import type { ModoDoCodigo } from '@/server/auth/login-por-numero'
import { AppError } from '@/server/http/errors'
import { PISO_DE_TEMPO_MS, pedirCodigoDeAcesso, type Dependencias } from '@/server/services/codigo-de-acesso'

/**
 * docs/119: só número cadastrado recebe código, e quem pede não descobre se o número existe.
 * Cada caso compara o que a rota DEVOLVE (corpo, erro, tempo) entre número cadastrado e desconhecido.
 */
function montar(over: Partial<Dependencias> & { cadastrado?: boolean; modo?: ModoDoCodigo } = {}) {
  let relogio = 0
  const enviar = vi.fn<Dependencias['enviar']>(async () => {
    relogio += 700
    return { ok: true }
  })
  const esperado: number[] = []
  const deps: Dependencias = {
    modo: over.modo ?? 'twilio',
    janelaDoLimiteSegundos: 3600,
    limitarPorNumero: async () => true,
    temCadastro: async () => over.cadastrado ?? true,
    enviar,
    esperar: async (ms) => {
      esperado.push(ms)
      relogio += ms
    },
    agora: () => relogio,
    registrar: vi.fn(),
    ...over,
  }
  return { deps, enviar: (over.enviar as typeof enviar | undefined) ?? enviar, esperado, tempo: () => relogio }
}

describe('pedir código de acesso (docs/119)', () => {
  it('número cadastrado: manda pelo WhatsApp do Twilio Verify', async () => {
    const m = montar({ cadastrado: true })
    await expect(pedirCodigoDeAcesso(m.deps)).resolves.toEqual({ enviado: true })
    expect(m.enviar).toHaveBeenCalledTimes(1)
    expect(m.enviar).toHaveBeenCalledWith('whatsapp')
  })

  it('número desconhecido: nada sai, e a resposta é a mesma', async () => {
    const m = montar({ cadastrado: false })
    await expect(pedirCodigoDeAcesso(m.deps)).resolves.toEqual({ enviado: true })
    expect(m.enviar).not.toHaveBeenCalled()
  })

  it('o tempo de resposta não separa cadastrado de desconhecido', async () => {
    const com = montar({ cadastrado: true })
    const sem = montar({ cadastrado: false })
    await pedirCodigoDeAcesso(com.deps)
    await pedirCodigoDeAcesso(sem.deps)
    expect(com.tempo()).toBe(PISO_DE_TEMPO_MS)
    expect(sem.tempo()).toBe(PISO_DE_TEMPO_MS)
  })

  it('falha do envio para número cadastrado também responde neutro, e o log acusa', async () => {
    const enviar = vi.fn<Dependencias['enviar']>(async () => ({ ok: false, motivo: '400 sms_send_failed' }))
    const m = montar({ cadastrado: true, enviar })
    await expect(pedirCodigoDeAcesso(m.deps)).resolves.toEqual({ enviado: true })
    expect(m.deps.registrar).toHaveBeenCalledWith('codigo_de_acesso_nao_enviado', expect.objectContaining({ motivo: '400 sms_send_failed' }))
  })

  it('exceção no envio ou na consulta não vira erro diferente', async () => {
    const m = montar({
      temCadastro: async () => {
        throw new Error('banco fora')
      },
    })
    await expect(pedirCodigoDeAcesso(m.deps)).resolves.toEqual({ enviado: true })
    expect(m.enviar).not.toHaveBeenCalled()
  })

  it('o limite por número vale igual para desconhecido, antes de olhar o cadastro', async () => {
    const temCadastro = vi.fn(async () => false)
    const m = montar({ limitarPorNumero: async () => false, temCadastro })
    await expect(pedirCodigoDeAcesso(m.deps)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    expect(temCadastro).not.toHaveBeenCalled()
  })

  it('modo de teste: não usa o canal do WhatsApp e registra que é teste', async () => {
    const m = montar({ modo: 'teste' })
    await pedirCodigoDeAcesso(m.deps)
    expect(m.enviar).toHaveBeenCalledWith('sms')
    expect(m.deps.registrar).toHaveBeenCalledWith('codigo_de_acesso_modo_teste')
  })

  it('produção sem as chaves: recusa igual para qualquer número, sem consultar nada', async () => {
    const temCadastro = vi.fn(async () => true)
    const m = montar({ modo: 'desligado', temCadastro })
    const erro = await pedirCodigoDeAcesso(m.deps).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(AppError)
    expect((erro as AppError).code).toBe('CODE_UNAVAILABLE')
    expect(temCadastro).not.toHaveBeenCalled()
    expect(m.enviar).not.toHaveBeenCalled()
  })
})
