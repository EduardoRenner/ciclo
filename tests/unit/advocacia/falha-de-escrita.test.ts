import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ehEscritaJuridica,
  explicarFalha,
  TEXTO_CONFLITO,
  TEXTO_SEGUNDO_FATOR,
  TEXTO_SEM_CONEXAO,
  TEXTO_SESSAO,
} from '@/core/advocacia/falha-de-escrita'

const salvarMutacao = vi.fn()
vi.mock('@/lib/offline/db', () => ({ salvarMutacao: (...a: unknown[]) => salvarMutacao(...a), listarMutacoes: async () => [], removerMutacao: async () => undefined }))

const { escreverJuridico } = await import('@/lib/advocacia/escrever')
const { apiFetch } = await import('@/lib/offline/api-client')

describe('explicarFalha (docs/101 T5.3)', () => {
  it('sem resposta é sem conexão', () => {
    expect(explicarFalha(null, 'x')).toEqual({ tipo: 'sem_conexao', texto: TEXTO_SEM_CONEXAO })
  })

  it('401 é sessão; o do segundo fator tem frase própria', () => {
    expect(explicarFalha({ status: 401, code: 'UNAUTHENTICATED' }, 'x')).toEqual({ tipo: 'sessao', texto: TEXTO_SESSAO })
    expect(explicarFalha({ status: 401, code: 'MFA_REQUIRED' }, 'x')).toEqual({ tipo: 'sessao', texto: TEXTO_SEGUNDO_FATOR })
  })

  it('409 CONFLICT é conflito de versão, sem o "recarregue" do servidor (apagaria o digitado)', () => {
    const f = explicarFalha({ status: 409, code: 'CONFLICT', message: 'Alguém alterou este caso. Recarregue para ver a versão atual.' }, 'x')
    expect(f).toEqual({ tipo: 'conflito', texto: TEXTO_CONFLITO })
    expect(f.texto).not.toMatch(/recarregue/i)
  })

  it('outro 409 fica com a frase do servidor', () => {
    expect(explicarFalha({ status: 409, code: 'SLOT_TAKEN', message: 'Esse horário acabou de ser reservado.' }, 'x')).toEqual({
      tipo: 'recusada',
      texto: 'Esse horário acabou de ser reservado.',
    })
  })

  it('recusa usa o campo, depois a mensagem, depois o padrão', () => {
    expect(explicarFalha({ status: 422, message: 'Dados inválidos.', campos: { motivo: 'Escreva o motivo.' } }, 'p').texto).toBe('Escreva o motivo.')
    expect(explicarFalha({ status: 403, message: 'Seu perfil não pode.' }, 'p').texto).toBe('Seu perfil não pode.')
    expect(explicarFalha({ status: 500 }, 'p').texto).toBe('p')
  })

  it('as frases dizem que o digitado continua (é a promessa da T5.3)', () => {
    for (const t of [TEXTO_SEM_CONEXAO, TEXTO_SESSAO, TEXTO_SEGUNDO_FATOR, TEXTO_CONFLITO]) expect(t).toMatch(/digitou continua/)
  })
})

describe('ehEscritaJuridica', () => {
  it.each([
    ['/api/v1/legal/deadlines', true],
    ['/api/v1/legal/cases/abc?x=1', true],
    ['https://seuciclo.com.br/api/v1/legal/documents', true],
    ['/api/v1/tenant/advocacia', true],
    ['/api/v1/tenant/advocacia#x', true],
    ['/api/v1/appointments', false],
    ['/api/v1/legalidade', false],
    ['/api/v1/tenant', false],
  ])('%s → %s', (url, esperado) => {
    expect(ehEscritaJuridica(url)).toBe(esperado)
  })
})

describe('escreverJuridico', () => {
  const fetchFalso = vi.fn()
  beforeEach(() => {
    fetchFalso.mockReset()
    salvarMutacao.mockReset()
    vi.stubGlobal('fetch', fetchFalso)
    vi.stubGlobal('navigator', { onLine: true })
  })
  afterEach(() => vi.unstubAllGlobals())

  const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

  it('offline: avisa sem tentar e sem enfileirar', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const r = await escreverJuridico('/api/v1/legal/deadlines', { method: 'POST', json: {} })
    expect(r).toMatchObject({ ok: false, tipo: 'sem_conexao' })
    expect(fetchFalso).not.toHaveBeenCalled()
    expect(salvarMutacao).not.toHaveBeenCalled()
  })

  it('a rede cai no meio: mesma frase, nada na fila', async () => {
    fetchFalso.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const r = await escreverJuridico('/api/v1/legal/deadlines', { method: 'POST', json: {} })
    expect(r).toMatchObject({ ok: false, tipo: 'sem_conexao', texto: TEXTO_SEM_CONEXAO })
    expect(salvarMutacao).not.toHaveBeenCalled()
  })

  it('sucesso devolve os dados; manda chave de idempotência e JSON', async () => {
    fetchFalso.mockResolvedValueOnce(resposta(201, { data: { id: 'p1' } }))
    const r = await escreverJuridico<{ id: string }>('/api/v1/legal/deadlines', { method: 'POST', json: { a: 1 } })
    expect(r).toEqual({ ok: true, dados: { id: 'p1' } })
    const [, init] = fetchFalso.mock.calls[0]! as [string, RequestInit]
    expect((init.headers as Record<string, string>)['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('FormData vai sem content-type (o navegador põe o boundary)', async () => {
    fetchFalso.mockResolvedValueOnce(resposta(201, { data: {} }))
    const form = new FormData()
    await escreverJuridico('/api/v1/legal/documents', { method: 'POST', form })
    const [, init] = fetchFalso.mock.calls[0]! as [string, RequestInit]
    expect((init.headers as Record<string, string>)['content-type']).toBeUndefined()
    expect(init.body).toBe(form)
  })

  it('409 de versão, 401 e 422 com campos', async () => {
    fetchFalso.mockResolvedValueOnce(resposta(409, { error: { code: 'CONFLICT', message: 'Recarregue.' } }))
    expect(await escreverJuridico('/api/v1/legal/cases/1', { method: 'PATCH', json: {} })).toMatchObject({ ok: false, tipo: 'conflito' })
    fetchFalso.mockResolvedValueOnce(resposta(401, { error: { code: 'UNAUTHENTICATED' } }))
    expect(await escreverJuridico('/api/v1/legal/cases/1', { method: 'PATCH', json: {} })).toMatchObject({ ok: false, tipo: 'sessao', texto: TEXTO_SESSAO })
    fetchFalso.mockResolvedValueOnce(resposta(422, { error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details: { fields: { title: 'Curto.' } } } }))
    expect(await escreverJuridico('/api/v1/legal/cases', { method: 'POST', json: {} })).toEqual({ ok: false, tipo: 'recusada', texto: 'Curto.', campos: { title: 'Curto.' } })
  })

  it('corpo que não é JSON (proxy devolvendo HTML) cai no padrão, sem estourar', async () => {
    fetchFalso.mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }))
    expect(await escreverJuridico('/api/v1/legal/cases', { method: 'POST', json: {} }, 'Padrão.')).toMatchObject({ ok: false, tipo: 'recusada', texto: 'Padrão.' })
  })
})

describe('apiFetch recusa escrita jurídica (a fila offline nunca a recebe)', () => {
  beforeEach(() => {
    salvarMutacao.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  it('offline: recusa em vez de enfileirar', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await expect(apiFetch('/api/v1/legal/deadlines', { method: 'POST', body: {} })).rejects.toThrow(/não entra na fila/)
    expect(salvarMutacao).not.toHaveBeenCalled()
  })

  it('controle positivo: rota que não é jurídica, offline, ENFILEIRA', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await expect(apiFetch('/api/v1/appointments', { method: 'POST', body: {} })).resolves.toEqual({ queued: true })
    expect(salvarMutacao).toHaveBeenCalledTimes(1)
  })
})
