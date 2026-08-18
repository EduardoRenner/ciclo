// TICKET-055. Service worker do app shell (§3, PWA). Escrito à mão — sem
// Workbox/next-pwa: a única regra que importa é pequena o bastante para não
// precisar de framework, e dá para conferir o deny-list de um jeito só,
// literal, sem confiar em configuração de um plugin de terceiro.
const CACHE_VERSAO = 'ciclo-v1'
const APP_SHELL = ['/hoje', '/agenda', '/clientes', '/recuperar', '/manifest.json']

// Regra do CLAUDE.md ("armadilhas conhecidas"): nunca cachear resposta de
// `/vault` ou mídia assinada no service worker. Generalizado para toda
// `/api/*` — nenhuma chamada de API deveria vir do cache do SW; o app shell
// (HTML/CSS/JS das rotas) é o que precisa abrir offline, não os dados.
const NUNCA_INTERCEPTAR = /^\/api\//

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

self.addEventListener('fetch', (event) => {
  const { request } = event
  // Mutação (POST/PATCH/DELETE) nunca passa pelo cache do SW — quem decide
  // se enfileira é `src/lib/offline/api-client.ts`, não o service worker.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (NUNCA_INTERCEPTAR.test(url.pathname)) return

  event.respondWith(
    caches.match(request).then((cacheado) => {
      const buscaDeRede = fetch(request)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone()
            caches.open(CACHE_VERSAO).then((cache) => cache.put(request, copia))
          }
          return resposta
        })
        .catch(() => cacheado)
      // stale-while-revalidate: mostra o cache na hora (app abre offline),
      // atualiza em segundo plano quando a rede volta.
      return cacheado || buscaDeRede
    }),
  )
})
