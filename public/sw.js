// TICKET-055 + docs/13-CAUSA-RAIZ-LAYOUT-LEGADO.md (T1). Service worker do app
// shell (§3, PWA). Escrito à mão — sem Workbox/next-pwa: a única regra que
// importa é pequena o bastante para não precisar de framework, e dá para
// conferir o deny-list de um jeito só, literal, sem confiar em configuração
// de um plugin de terceiro.
//
// Causa raiz do "layout roxo que volta" (docs/13, §2): o nome do cache era uma
// string fixa (`ciclo-v2`) que parou de mudar em 19/08 05:38 — 15 horas antes
// do redesign tirar o roxo do produto. Quem abriu o app nessa janela guardou
// o shell roxo para sempre, porque `activate` só apaga cache com nome
// DIFERENTE do atual, e o nome nunca mudava sozinho. A versão agora vem da
// própria URL do worker (`?v=<build>`), que o `registrar-service-worker.tsx`
// monta a partir de `NEXT_PUBLIC_BUILD_ID` — todo deploy novo é um worker novo,
// então todo deploy novo invalida o cache do anterior sozinho.
const VERSAO = new URL(self.location.href).searchParams.get('v') || 'dev'
const CACHE_VERSAO = `ciclo-${VERSAO}`

// Só a casca ESTÁTICA e pública entra no pré-cache do install — nenhuma rota
// autenticada. `/admin/*` guarda faturamento do dia, nome de cliente e agenda
// por trás de sessão; cachear por URL faria a segunda pessoa a abrir o mesmo
// aparelho (o tablet do balcão) herdar a tela renderizada da primeira, e a
// tela sobreviveria ao próprio logout. Ver docs/13 §4.3.
const APP_SHELL = ['/manifest.json']

// Regra do CLAUDE.md ("armadilhas conhecidas"): nunca cachear resposta de
// `/vault` ou mídia assinada no service worker. Generalizado para toda rota
// que exige sessão — nenhuma delas deveria sobreviver no cache do SW, só o
// que é público é seguro para indexar apenas por URL.
const NUNCA_CACHEAR = /^\/(api|auth|admin|onboarding|entrar|cadastro|verificar|nova-senha|recuperar-senha)(\/|$)/

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSAO).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE_VERSAO).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

/**
 * `/_next/static/*` leva hash no nome — o mesmo arquivo nunca muda de
 * conteúdo sob a mesma URL, então cache-first sem revalidar é seguro e mais
 * rápido que qualquer outra estratégia.
 */
function ehEstaticoImutavel(url) {
  return url.pathname.startsWith('/_next/static/')
}

async function respostaCacheavel(resposta) {
  if (!resposta || !resposta.ok) return false
  // O servidor já decide isto (`src/middleware.ts`, HTML de `/admin/*` sai com
  // `no-store`); o SW obedecer é a segunda camada da mesma regra — nenhuma
  // resposta marcada assim pode sobreviver fora do controle de quem a serviu.
  const cc = resposta.headers.get('cache-control') || ''
  return !/no-store/i.test(cc)
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Mutação (POST/PATCH/DELETE) nunca passa pelo cache do SW — quem decide
  // se enfileira é `src/lib/offline/api-client.ts`, não o service worker.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (NUNCA_CACHEAR.test(url.pathname)) return

  if (ehEstaticoImutavel(url)) {
    event.respondWith(
      caches.match(request).then(
        (cacheado) =>
          cacheado ||
          fetch(request).then(async (resposta) => {
            if (await respostaCacheavel(resposta)) {
              const copia = resposta.clone()
              const cache = await caches.open(CACHE_VERSAO)
              cache.put(request, copia)
            }
            return resposta
          }),
      ),
    )
    return
  }

  // HTML público (`/`, `/{slug}`, `/{slug}/agendar`, `/manifest.json`):
  // network-first. Conteúdo muda (agenda, catálogo, preço) e não pode ficar
  // uma versão atrasada — o cache só socorre quem está sem rede.
  event.respondWith(
    fetch(request)
      .then(async (resposta) => {
        if (await respostaCacheavel(resposta)) {
          const copia = resposta.clone()
          const cache = await caches.open(CACHE_VERSAO)
          cache.put(request, copia)
        }
        return resposta
      })
      .catch(() => caches.match(request)),
  )
})

// TICKET-056. Payload é o JSON que `src/server/providers/messaging/push.ts`
// manda (`{ title, body, url }`) — se o push chegar sem corpo (o navegador
// permite), cai num texto genérico em vez de quebrar.
self.addEventListener('push', (event) => {
  let dado = { title: 'CICLO', body: 'Você tem uma novidade.', url: '/admin/hoje' }
  try {
    if (event.data) dado = { ...dado, ...event.data.json() }
  } catch {
    // payload não era JSON — fica no texto genérico acima.
  }

  event.waitUntil(
    self.registration.showNotification(dado.title, {
      body: dado.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: dado.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = event.notification.data?.url ?? '/admin/hoje'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => new URL(j.url).pathname === destino)
      if (aberta) return aberta.focus()
      return self.clients.openWindow(destino)
    }),
  )
})
