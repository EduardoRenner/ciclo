import type { MetadataRoute } from 'next'

import { APP_URL } from '@/lib/app-url'

/**
 * `/admin` já leva `robots: noindex` na própria página (defesa em profundidade);
 * aqui é a primeira barreira, antes mesmo do crawler abrir a rota.
 */
export default function robots(): MetadataRoute.Robots {
  const base = APP_URL

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/entrar', '/cadastro', '/onboarding', '/nova-senha', '/recuperar-senha', '/verificar'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
