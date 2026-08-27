import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GeminiProvider } from '@/server/providers/ai/gemini'
import { ErroDeInferencia } from '@/server/providers/ai/types'

const ORIGINAL = { ...process.env }

describe('GeminiProvider', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'chave-de-teste'
  })
  afterEach(() => {
    process.env = { ...ORIGINAL }
    vi.unstubAllGlobals()
  })

  it('sem GEMINI_API_KEY estoura ErroDeInferencia(sem_credencial) em vez de tentar a rede (docs/26 §4.4)', async () => {
    delete process.env.GEMINI_API_KEY
    const provider = new GeminiProvider()

    await expect(provider.perguntar({ mensagens: [{ papel: 'usuario', texto: 'oi' }], ferramentas: [] })).rejects.toMatchObject({
      motivo: 'sem_credencial',
    })
  })

  it('devolve texto quando o modelo responde sem chamar ferramenta', async () => {
    const fetchFalso = vi.fn(async () =>
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Você tem 2 horários vagos.' }] } }] }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchFalso)

    const provider = new GeminiProvider()
    const resposta = await provider.perguntar({ mensagens: [{ papel: 'usuario', texto: 'tenho vaga?' }], ferramentas: [] })

    expect(resposta).toEqual({ tipo: 'texto', texto: 'Você tem 2 horários vagos.' })
  })

  it('devolve chamada_ferramenta quando o modelo pede functionCall', async () => {
    const fetchFalso = vi.fn(async () =>
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: 'clientes_para_recuperar', args: {} } }] } }] }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchFalso)

    const provider = new GeminiProvider()
    const resposta = await provider.perguntar({ mensagens: [{ papel: 'usuario', texto: 'quem sumiu?' }], ferramentas: [] })

    expect(resposta).toEqual({ tipo: 'chamada_ferramenta', nome: 'clientes_para_recuperar', argumentos: '{}' })
  })

  it('manda um AbortSignal com prazo — mesmo motivo de whatsapp.ts (travar aqui prende o handler da rota)', async () => {
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal)
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFalso)

    const provider = new GeminiProvider()
    await provider.perguntar({ mensagens: [{ papel: 'usuario', texto: 'oi' }], ferramentas: [] })

    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })

  it('status HTTP de erro vira ErroDeInferencia(falha_do_provedor), nunca exceção crua', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('erro interno', { status: 500 })),
    )
    const provider = new GeminiProvider()

    await expect(provider.perguntar({ mensagens: [{ papel: 'usuario', texto: 'oi' }], ferramentas: [] })).rejects.toBeInstanceOf(ErroDeInferencia)
  })

  it('timeout de rede vira ErroDeInferencia(timeout)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('aborted', 'TimeoutError')
      }),
    )
    const provider = new GeminiProvider()

    await expect(provider.perguntar({ mensagens: [{ papel: 'usuario', texto: 'oi' }], ferramentas: [] })).rejects.toMatchObject({
      motivo: 'timeout',
    })
  })

  it('envia as ferramentas no formato functionDeclarations do Gemini', async () => {
    const fetchFalso = vi.fn(async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(init.body as string)
      expect(corpo.tools).toEqual([
        { functionDeclarations: [{ name: 'buscar_cliente', description: 'procura cliente', parameters: { type: 'object' } }] },
      ])
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFalso)

    const provider = new GeminiProvider()
    await provider.perguntar({
      mensagens: [{ papel: 'usuario', texto: 'oi' }],
      ferramentas: [{ nome: 'buscar_cliente', descricao: 'procura cliente', parametros: { type: 'object' } }],
    })

    expect(fetchFalso).toHaveBeenCalledTimes(1)
  })
})
