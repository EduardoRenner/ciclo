import { readFileSync } from 'node:fs'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError, ERROR_CODES, type ErrorCode } from '@/server/http/errors'
import { rota } from '@/server/http/handler'
import { resolverRequestId, respostaOk } from '@/server/http/response'

function requisicao(headers: Record<string, string> = {}): Request {
  return new Request('https://app.ciclo.test/api/v1/clients?q=Maria%20Silva', {
    method: 'GET',
    headers,
  })
}

describe('a lista de códigos é a mesma da documentação', () => {
  // O contrato de erro é fechado (docs/02-API.md §1). Se alguém inventar um
  // código no TypeScript e esquecer a tabela, ou mudar o status de um erro
  // existente, este teste reprova antes do cliente descobrir.
  const doc = readFileSync('docs/02-API.md', 'utf8')
  const naDoc = new Map<string, number>()
  for (const linha of doc.split('\n')) {
    const m = /^\|\s*`([A-Z_]+)`\s*\|\s*(\d{3})\s*\|/.exec(linha)
    if (m?.[1] && m[2]) naDoc.set(m[1], Number(m[2]))
  }

  it('a tabela da documentação foi encontrada', () => {
    expect(naDoc.size).toBeGreaterThan(10)
  })

  it('nenhum código a mais nem a menos', () => {
    expect(Object.keys(ERROR_CODES).sort()).toEqual([...naDoc.keys()].sort())
  })

  it('o status de cada código bate com a documentação', () => {
    for (const [code, status] of naDoc) {
      expect(ERROR_CODES[code as ErrorCode].status, code).toBe(status)
    }
  })

  it('toda mensagem é pt-BR e nenhuma expõe jargão de banco', () => {
    for (const [code, { message }] of Object.entries(ERROR_CODES)) {
      expect(message.length, code).toBeGreaterThan(10)
      expect(message, code).not.toMatch(/error|exception|null|undefined|postgres|sql/i)
    }
  })
})

describe('AppError', () => {
  it('usa o status e a mensagem padrão do código', () => {
    const erro = new AppError('SLOT_TAKEN')
    expect(erro.status).toBe(409)
    expect(erro.publicMessage).toBe('Esse horário acabou de ser reservado.')
  })

  it('aceita mensagem própria em erro de negócio', () => {
    const erro = new AppError('NOT_FOUND', { message: 'Essa cliente não está mais na sua lista.' })
    expect(erro.publicMessage).toBe('Essa cliente não está mais na sua lista.')
  })

  it('INTERNAL ignora mensagem customizada — é por onde vazaria o erro do banco', () => {
    const erro = new AppError('INTERNAL', {
      message: 'relation "clients" does not exist at character 15',
    })
    expect(erro.publicMessage).toBe(ERROR_CODES.INTERNAL.message)
    expect(erro.publicMessage).not.toContain('relation')
  })

  it('validacao() monta details.fields', () => {
    const erro = AppError.validacao({ phone: 'Telefone inválido. Use DDD + número.' })
    expect(erro.code).toBe('VALIDATION_ERROR')
    expect(erro.status).toBe(422)
    expect(erro.details).toEqual({ fields: { phone: 'Telefone inválido. Use DDD + número.' } })
  })

  it('limiteDeTaxa() arredonda para cima e devolve Retry-After', () => {
    const erro = AppError.limiteDeTaxa(2.1)
    expect(erro.headers).toEqual({ 'Retry-After': '3' })
    expect(erro.details).toEqual({ retryAfterSeconds: 3 })
  })

  it('de() preserva o AppError e embrulha o resto em INTERNAL', () => {
    const meu = new AppError('FORBIDDEN')
    expect(AppError.de(meu)).toBe(meu)

    const cru = AppError.de('string solta')
    expect(cru.code).toBe('INTERNAL')
    expect(cru.cause).toBe('string solta')
  })
})

describe('requestId', () => {
  it('reaproveita o x-request-id de quem chamou', () => {
    expect(resolverRequestId(new Headers({ 'x-request-id': 'req_abc12345' }))).toBe('req_abc12345')
  })

  it('descarta valor fora do formato em vez de repassar', () => {
    for (const suspeito of ['curto', 'com espaço', '<script>alert(1)</script>', 'x'.repeat(200)]) {
      const id = resolverRequestId(new Headers({ 'x-request-id': suspeito }))
      expect(id).not.toBe(suspeito)
      expect(id).toMatch(/^req_[0-9a-f]{32}$/)
    }
  })

  it('gera um id diferente a cada request quando não vem nada', () => {
    expect(resolverRequestId()).not.toBe(resolverRequestId())
  })
})

describe('envelope de resposta', () => {
  it('sucesso simples traz data e meta.requestId', async () => {
    const r = respostaOk({ id: 'abc' }, { requestId: 'req_teste12' })
    expect(r.status).toBe(200)
    expect(r.headers.get('x-request-id')).toBe('req_teste12')
    expect(await r.json()).toEqual({ data: { id: 'abc' }, meta: { requestId: 'req_teste12' } })
  })

  it('lista paginada traz nextCursor e total', async () => {
    const r = respostaOk([{ id: 'a' }], { requestId: 'req_teste12', nextCursor: 'eyJ', total: 312 })
    expect(await r.json()).toEqual({
      data: [{ id: 'a' }],
      meta: { requestId: 'req_teste12', nextCursor: 'eyJ', total: 312 },
    })
  })

  it('sem cursor, meta não ganha chave vazia', async () => {
    const corpo = (await respostaOk({}, { requestId: 'req_teste12' }).json()) as { meta: object }
    expect(Object.keys(corpo.meta)).toEqual(['requestId'])
  })
})

describe('handler global', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('embrulha o retorno da rota no envelope', async () => {
    const handler = rota(async () => ({ nome: 'Bruna' }))
    const r = await handler(requisicao(), undefined)
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ data: { nome: 'Bruna' } })
  })

  it('AppError vira o código e o status certos', async () => {
    const handler = rota(async () => {
      throw new AppError('SLOT_TAKEN', { details: { alternatives: ['2026-08-20T18:00:00Z'] } })
    })
    const r = await handler(requisicao(), undefined)
    expect(r.status).toBe(409)
    expect(await r.json()).toMatchObject({
      error: { code: 'SLOT_TAKEN', details: { alternatives: ['2026-08-20T18:00:00Z'] } },
    })
  })

  it('erro inesperado vira INTERNAL sem stack e sem a mensagem original', async () => {
    const handler = rota(async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.4:5432 senha=hunter2')
    })
    const r = await handler(requisicao(), undefined)
    const texto = await r.text()

    expect(r.status).toBe(500)
    expect(texto).not.toContain('ECONNREFUSED')
    expect(texto).not.toContain('hunter2')
    expect(texto).not.toContain('at ') // nada de frame de stack
    expect(JSON.parse(texto)).toEqual({
      error: { code: 'INTERNAL', message: ERROR_CODES.INTERNAL.message },
      meta: { requestId: expect.stringMatching(/^req_/) as unknown as string },
    })
  })

  it('o header Retry-After chega na resposta', async () => {
    const handler = rota(async () => {
      throw AppError.limiteDeTaxa(30)
    })
    const r = await handler(requisicao(), undefined)
    expect(r.status).toBe(429)
    expect(r.headers.get('Retry-After')).toBe('30')
  })

  it('o log de erro não leva a query string, que carrega nome de cliente', async () => {
    const erro = vi.mocked(console.error)
    const handler = rota(async () => {
      throw new Error('falhou')
    })
    await handler(requisicao({ 'x-tenant-id': 'tenant-1' }), undefined)

    const linha = JSON.parse(String(erro.mock.calls[0]?.[0])) as Record<string, unknown>
    expect(linha).toMatchObject({ level: 'error', tenant_id: 'tenant-1', path: '/api/v1/clients' })
    expect(JSON.stringify(linha)).not.toContain('Maria')
  })

  it('erro de 4xx é warn, não error: não acorda ninguém de madrugada', async () => {
    const handler = rota(async () => {
      throw new AppError('NOT_FOUND')
    })
    await handler(requisicao(), undefined)
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('Response montada pela rota passa direto, mas ganha o x-request-id', async () => {
    const handler = rota(async () => new Response('pdf', { status: 200 }))
    const r = await handler(requisicao({ 'x-request-id': 'req_abc12345' }), undefined)
    expect(await r.text()).toBe('pdf')
    expect(r.headers.get('x-request-id')).toBe('req_abc12345')
  })
})

// V2 (verificação estrutural, Gate 5.1.5): Origin explícito nas rotas que escrevem, segunda
// camada de defesa além do SameSite do cookie.
describe('handler global · verificação de Origin (CSRF)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Unit test não carrega .env.local (só os de integração fazem isso) — a checagem de
    // Origin depende de NEXT_PUBLIC_APP_URL, então cada teste fixa o valor que precisa.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.ciclo.test')
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  function requisicaoMutante(method: string, headers: Record<string, string> = {}): Request {
    return new Request('https://app.ciclo.test/api/v1/clients', { method, headers })
  }

  it('POST sem header Origin passa — é o caso normal de servidor-a-servidor (cron, webhook)', async () => {
    const handler = rota(async () => ({ ok: true }))
    const r = await handler(requisicaoMutante('POST'), undefined)
    expect(r.status).toBe(200)
  })

  it('POST com Origin igual ao app passa', async () => {
    const handler = rota(async () => ({ ok: true }))
    const r = await handler(requisicaoMutante('POST', { origin: 'https://app.ciclo.test' }), undefined)
    expect(r.status).toBe(200)
  })

  it('sem NEXT_PUBLIC_APP_URL configurada, a checagem não trava a escrita (não dá pra comparar)', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    const handler = rota(async () => ({ ok: true }))
    const r = await handler(requisicaoMutante('POST', { origin: 'https://qualquer-coisa.test' }), undefined)
    expect(r.status).toBe(200)
  })

  it('POST com Origin de outro site é recusado — FORBIDDEN, não chega a rodar o handler', async () => {
    let handlerRodou = false
    const handler = rota(async () => {
      handlerRodou = true
      return { ok: true }
    })
    const r = await handler(requisicaoMutante('POST', { origin: 'https://site-malicioso.test' }), undefined)
    expect(r.status).toBe(403)
    expect(handlerRodou).toBe(false)
    expect((await r.json()) as { error: { code: string } }).toMatchObject({ error: { code: 'FORBIDDEN' } })
  })

  it('GET com Origin de outro site passa — a checagem é só pra método que escreve', async () => {
    const handler = rota(async () => ({ ok: true }))
    const r = await handler(new Request('https://app.ciclo.test/api/v1/clients', { headers: { origin: 'https://site-malicioso.test' } }), undefined)
    expect(r.status).toBe(200)
  })
})
