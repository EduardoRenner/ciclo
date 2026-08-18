import { createHash } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { avaliarSenhaLocal, exigirSenhaForte, SENHA_MINIMA, senhaVazada } from '@/server/auth/password'
import { AppError } from '@/server/http/errors'

/** Responde como a API do HIBP: linhas `SUFIXO:CONTAGEM`. */
function hibpFalso(vazadas: string[], extras: string[] = []) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const prefixo = url.slice(-5)
    const linhas = [
      ...vazadas
        .map((senha) => createHash('sha1').update(senha, 'utf8').digest('hex').toUpperCase())
        .filter((h) => h.startsWith(prefixo))
        .map((h) => `${h.slice(5)}:42`),
      ...extras,
    ]

    // O HIBP real só enche a resposta quando o header pede; o falso imita para o
    // teste exercitar o descarte das linhas de contagem zero.
    const cabecalhos = init?.headers as Record<string, string> | undefined
    if (cabecalhos?.['Add-Padding'] === 'true') linhas.push(`${'A'.repeat(35)}:0`)

    return new Response(linhas.join('\r\n'), { status: 200 })
  })
}

describe('política local de senha', () => {
  it('reprova senha mais curta que o mínimo', () => {
    expect(avaliarSenhaLocal('a'.repeat(SENHA_MINIMA - 1))).toBe('curta')
    expect(avaliarSenhaLocal('')).toBe('curta')
  })

  it('reprova sequência de dígitos, que passa no tamanho', () => {
    expect(avaliarSenhaLocal('1234567890')).toBe('comum')
    expect(avaliarSenhaLocal('0987654321')).toBe('comum')
    expect(avaliarSenhaLocal('0000000000')).toBe('comum')
  })

  it('reprova raiz comum mesmo com número e símbolo colados', () => {
    // É exatamente o que a pessoa faz quando o sistema exige "um número".
    for (const senha of ['senha123456', 'Flamengo2024!', 'qwertyuiop12', 'DeusEFiel00']) {
      expect(avaliarSenhaLocal(senha), senha).toBe('comum')
    }
  })

  it('enxerga a raiz comum através do acento', () => {
    expect(avaliarSenhaLocal('sênha123456')).toBe('comum')
  })

  it('aprova frase longa sem símbolo — a FAQ C38 não exige símbolo', () => {
    expect(avaliarSenhaLocal('cabelo roxo na terca feira')).toBeNull()
    expect(avaliarSenhaLocal('MinhaGataSubiuNoTelhado')).toBeNull()
  })
})

describe('HIBP por k-anonymity', () => {
  afterEach(() => vi.restoreAllMocks())

  it('manda só os 5 primeiros caracteres do hash, nunca a senha', async () => {
    const buscar = hibpFalso([])
    await senhaVazada('umaSenhaQualquer', buscar)

    const [url, init] = buscar.mock.calls[0] ?? []
    expect(url).toMatch(/^https:\/\/api\.pwnedpasswords\.com\/range\/[0-9A-F]{5}$/)
    expect(url).not.toContain('umaSenhaQualquer')
    // Sem padding, o tamanho da resposta já entrega quantos hashes casam.
    expect((init?.headers as Record<string, string>)['Add-Padding']).toBe('true')
  })

  it('acha a senha vazada pelo sufixo do hash', async () => {
    expect(await senhaVazada('correcthorsebattery', hibpFalso(['correcthorsebattery']))).toBe(true)
  })

  it('não confunde com o hash de outra senha do mesmo prefixo', async () => {
    expect(await senhaVazada('umaSenhaQualquer', hibpFalso(['outraSenhaTotalmenteDiferente']))).toBe(false)
  })

  it('ignora as linhas de padding, que vêm com contagem zero', async () => {
    const hash = createHash('sha1').update('senhaComPadding', 'utf8').digest('hex').toUpperCase()
    const buscar = hibpFalso([], [`${hash.slice(5)}:0`])
    expect(await senhaVazada('senhaComPadding', buscar)).toBe(false)
  })

  it('devolve null quando o HIBP responde erro ou cai', async () => {
    expect(await senhaVazada('qualquer', vi.fn(async () => new Response('', { status: 503 })))).toBeNull()
    expect(
      await senhaVazada(
        'qualquer',
        vi.fn(async () => {
          throw new Error('ECONNRESET')
        }),
      ),
    ).toBeNull()
  })
})

describe('exigirSenhaForte', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lança VALIDATION_ERROR no campo password quando a senha é fraca', async () => {
    const erro = await exigirSenhaForte('senha123456', hibpFalso([])).catch((e: unknown) => e)

    expect(erro).toBeInstanceOf(AppError)
    expect((erro as AppError).code).toBe('VALIDATION_ERROR')
    expect((erro as AppError).status).toBe(422)
    expect((erro as AppError).details).toMatchObject({ fields: { password: expect.any(String) as unknown as string } })
  })

  it('não chega no HIBP quando já reprovou localmente', async () => {
    const buscar = hibpFalso([])
    await exigirSenhaForte('curta', buscar).catch(() => {})
    expect(buscar).not.toHaveBeenCalled()
  })

  it('reprova senha que só o HIBP conhece', async () => {
    const senha = 'NinguemAdivinhaIsso42'
    expect(avaliarSenhaLocal(senha)).toBeNull()

    await expect(exigirSenhaForte(senha, hibpFalso([senha]))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('deixa passar quando o HIBP está fora do ar, e registra', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fora = vi.fn(async () => new Response('', { status: 503 }))

    await expect(exigirSenhaForte('MinhaGataSubiuNoTelhado', fora)).resolves.toBeUndefined()
    expect(String(aviso.mock.calls[0]?.[0])).toContain('hibp_indisponivel')
  })

  it('aprova senha forte e não vazada', async () => {
    await expect(exigirSenhaForte('cabelo roxo na terca feira', hibpFalso([]))).resolves.toBeUndefined()
  })
})
