import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

/**
 * docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md — o teste que fecha a causa raiz do
 * "layout roxo que volta": `public/sw.js` é JavaScript puro sem módulo (roda
 * no escopo global de um worker), então carregá-lo aqui é executar o próprio
 * código de produção dentro de um sandbox `vm`, não uma reimplementação em
 * paralelo que poderia divergir silenciosamente do arquivo real.
 *
 * O bug original: o nome do cache era uma string fixa (`ciclo-v2`) que parou
 * de mudar 15 horas antes do roxo sair do produto — `activate` só apaga cache
 * com nome DIFERENTE do atual, e como o nome nunca mudava sozinho, quem tinha
 * cache antigo nunca era limpo por nenhum deploy seguinte. A correção faz o
 * nome vir da própria URL do worker (`?v=<build>`); o teste A prova isso e o
 * teste B prova que `activate` de fato limpa o que sobrou de um deploy
 * anterior — sem os dois, a regressão de 19/08 poderia se repetir silenciosa.
 */

const CAMINHO_SW = path.join(process.cwd(), 'public', 'sw.js')

class FakeCache {
  store = new Map<string, unknown>()
  chave(req: string | { url: string }) {
    return typeof req === 'string' ? req : req.url
  }
  async match(req: string | { url: string }) {
    return this.store.get(this.chave(req))
  }
  async put(req: string | { url: string }, resposta: unknown) {
    this.store.set(this.chave(req), resposta)
  }
  async addAll(urls: string[]) {
    for (const u of urls) this.store.set(u, fakeResponse())
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>()
  async open(nome: string) {
    if (!this.caches.has(nome)) this.caches.set(nome, new FakeCache())
    return this.caches.get(nome)!
  }
  async keys() {
    return [...this.caches.keys()]
  }
  async delete(nome: string) {
    return this.caches.delete(nome)
  }
  async match(req: string | { url: string }) {
    for (const c of this.caches.values()) {
      const r = await c.match(req)
      if (r !== undefined) return r
    }
    return undefined
  }
}

function fakeResponse(opcoes: { ok?: boolean; cacheControl?: string | null; corpo?: string } = {}) {
  const { ok = true, cacheControl = null, corpo = 'ok' } = opcoes
  return {
    ok,
    headers: { get: (k: string) => (k.toLowerCase() === 'cache-control' ? cacheControl : null) },
    clone() {
      return fakeResponse({ ok, cacheControl, corpo })
    },
    _corpo: corpo,
  }
}

type EventoFake = {
  request?: { url: string; method: string }
  waitUntil: (p: Promise<unknown>) => void
  respondWith: (p: Promise<unknown>) => void
}
type Listener = (evento: EventoFake) => void
type Listeners = Record<string, Listener>
type Requisicao = { url: string }
type RespostaFake = ReturnType<typeof fakeResponse>

/**
 * Executa o `public/sw.js` de verdade num sandbox — não uma cópia reescrita.
 * `versao` vira `?v=<versao>` na URL do worker; passe `null` para simular um
 * registro sem o parâmetro (o caso "cai em dev").
 */
function carregarServiceWorker(
  versao: string | null,
  cacheStorage: FakeCacheStorage,
  fetchImpl: (req: Requisicao) => Promise<RespostaFake>,
) {
  const codigo = readFileSync(CAMINHO_SW, 'utf8')
  const listeners: Listeners = {}
  const query = versao === null ? '' : `?v=${versao}`
  const sandbox: Record<string, unknown> = {
    self: {
      location: { href: `https://ciclo-umber.vercel.app/sw.js${query}` },
      addEventListener: (tipo: string, fn: Listener) => {
        listeners[tipo] = fn
      },
      skipWaiting: () => {},
      clients: { claim: async () => {} },
      registration: { showNotification: async () => {} },
    },
    caches: cacheStorage,
    fetch: fetchImpl,
    URL,
    console,
  }
  vm.createContext(sandbox)
  vm.runInContext(codigo, sandbox, { filename: 'sw.js' })
  return listeners
}

async function disparar(listeners: Listeners, tipo: string, evento: Partial<EventoFake>) {
  let promessa: Promise<unknown> | undefined
  const eventoCompleto: EventoFake = {
    ...evento,
    waitUntil: (p) => {
      promessa = p
    },
    respondWith: (p) => {
      promessa = p
    },
  }
  listeners[tipo]!(eventoCompleto)
  return promessa
}

describe('service worker — versionamento do cache', () => {
  it('A · o nome do cache inclui a versão vinda da URL do worker', async () => {
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse())

    await disparar(listeners, 'install', {})

    expect([...storage.caches.keys()]).toEqual(['ciclo-sha-novo'])
  })

  it('B · activate apaga cache de deploy anterior — é isto que impede a regressão de 19/08', async () => {
    const storage = new FakeCacheStorage()
    // Simula o estado real encontrado em produção: um cache de um deploy velho,
    // parado há dias, sobrevivendo porque nada nunca mudava o nome.
    await storage.open('ciclo-v2')

    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse())
    await disparar(listeners, 'install', {})
    await disparar(listeners, 'activate', {})

    expect([...storage.caches.keys()]).toEqual(['ciclo-sha-novo'])
  })

  it('sem versão na URL, cai em "dev" — nunca em algo indefinido', async () => {
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker(null, storage, async () => fakeResponse())

    await disparar(listeners, 'install', {})
    expect([...storage.caches.keys()]).toEqual(['ciclo-dev'])
  })

  it('`?v=` presente mas vazio também cai em "dev" — é o que aconteceu no primeiro deploy desta correção', async () => {
    // `VERCEL_GIT_COMMIT_SHA` veio como string vazia (não ausente) num deploy
    // sem git conectado, e `??` em `next.config.ts` não pegava isso — o
    // navegador registrava `/sw.js?v=` (parâmetro presente, valor vazio).
    // `searchParams.get('v')` devolve `''` nesse caso, não `null`, então só o
    // `|| 'dev'` do próprio sw.js (não um `??`) protege daqui pra frente.
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker('', storage, async () => fakeResponse())

    await disparar(listeners, 'install', {})
    expect([...storage.caches.keys()]).toEqual(['ciclo-dev'])
  })
})

describe('service worker — tela autenticada nunca entra no cache', () => {
  it('9 · /admin/* não é interceptado — nunca vira candidato a cache', async () => {
    const storage = new FakeCacheStorage()
    let redeChamada = false
    const listeners = carregarServiceWorker('sha-novo', storage, async () => {
      redeChamada = true
      return fakeResponse()
    })
    await disparar(listeners, 'install', {})

    const resultado = await disparar(listeners, 'fetch', {
      request: { url: 'https://ciclo-umber.vercel.app/admin/hoje', method: 'GET' },
    })

    // Nem `respondWith` é chamado: o SW devolve o controle ao navegador, que
    // busca a rede normalmente — o handler não intercepta a rota de propósito.
    expect(resultado).toBeUndefined()
    expect(redeChamada).toBe(false)
    const cache = await storage.open('ciclo-sha-novo')
    expect(await cache.match({ url: 'https://ciclo-umber.vercel.app/admin/hoje' })).toBeUndefined()
  })

  it('9 · /onboarding, /entrar e /api também ficam de fora', async () => {
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse())

    for (const caminho of ['/onboarding', '/entrar', '/api/v1/clients', '/auth/callback', '/nova-senha']) {
      const resultado = await disparar(listeners, 'fetch', {
        request: { url: `https://ciclo-umber.vercel.app${caminho}`, method: 'GET' },
      })
      expect(resultado, caminho).toBeUndefined()
    }
  })

  it('POST/PATCH/DELETE nunca é interceptado, mesmo em rota pública', async () => {
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse())

    const resultado = await disparar(listeners, 'fetch', {
      request: { url: 'https://ciclo-umber.vercel.app/api/v1/public/dom-rocha/book', method: 'POST' },
    })
    expect(resultado).toBeUndefined()
  })
})

describe('service worker — obedece Cache-Control: no-store', () => {
  it('resposta pública com no-store não é gravada no cache', async () => {
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse({ cacheControl: 'private, no-store' }))

    await disparar(listeners, 'fetch', { request: { url: 'https://ciclo-umber.vercel.app/dom-rocha', method: 'GET' } })

    const cache = await storage.open('ciclo-sha-novo')
    expect(await cache.match({ url: 'https://ciclo-umber.vercel.app/dom-rocha' })).toBeUndefined()
  })

  it('resposta pública cacheável É gravada', async () => {
    const storage = new FakeCacheStorage()
    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse({ cacheControl: null }))

    await disparar(listeners, 'fetch', { request: { url: 'https://ciclo-umber.vercel.app/dom-rocha', method: 'GET' } })

    const cache = await storage.open('ciclo-sha-novo')
    expect(await cache.match({ url: 'https://ciclo-umber.vercel.app/dom-rocha' })).toBeDefined()
  })
})

describe('service worker — estratégias por tipo de recurso', () => {
  it('estático com hash (/_next/static/*): cache-first — não bate na rede se já tem cache', async () => {
    const storage = new FakeCacheStorage()
    let chamadasDeRede = 0
    const listeners = carregarServiceWorker('sha-novo', storage, async () => {
      chamadasDeRede++
      return fakeResponse({ corpo: 'v1' })
    })

    const url = 'https://ciclo-umber.vercel.app/_next/static/chunks/app.abc123.js'
    await disparar(listeners, 'fetch', { request: { url, method: 'GET' } })
    expect(chamadasDeRede).toBe(1)

    // Segunda vez: já está em cache, e o arquivo tem hash no nome — não pode
    // mudar de conteúdo sob a mesma URL, então nunca precisa checar a rede de novo.
    await disparar(listeners, 'fetch', { request: { url, method: 'GET' } })
    expect(chamadasDeRede).toBe(1)
  })

  it('HTML público: network-first — a rede sempre é tentada primeiro', async () => {
    const storage = new FakeCacheStorage()
    let versaoServida = 'v1'
    const listeners = carregarServiceWorker('sha-novo', storage, async () => fakeResponse({ corpo: versaoServida }))

    const url = 'https://ciclo-umber.vercel.app/dom-rocha'
    const r1 = (await disparar(listeners, 'fetch', { request: { url, method: 'GET' } })) as RespostaFake
    expect(r1._corpo).toBe('v1')

    versaoServida = 'v2'
    const r2 = (await disparar(listeners, 'fetch', { request: { url, method: 'GET' } })) as RespostaFake
    expect(r2._corpo).toBe('v2')
  })

  it('HTML público: sem rede, cai no cache — é o que sustenta abrir offline', async () => {
    const storage = new FakeCacheStorage()
    const url = 'https://ciclo-umber.vercel.app/dom-rocha'

    let comRede = true
    const listeners = carregarServiceWorker('sha-novo', storage, async () => {
      if (!comRede) throw new Error('offline')
      return fakeResponse({ corpo: 'versao-boa' })
    })

    await disparar(listeners, 'fetch', { request: { url, method: 'GET' } })

    comRede = false
    const resultado = (await disparar(listeners, 'fetch', { request: { url, method: 'GET' } })) as RespostaFake
    expect(resultado._corpo).toBe('versao-boa')
  })
})
