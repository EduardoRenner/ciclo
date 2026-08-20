import type { MetadataRoute } from 'next'

/**
 * `/admin` já leva `robots: noindex` na própria página (defesa em profundidade);
 * aqui é a primeira barreira, antes mesmo do crawler abrir a rota.
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ciclo.app'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/entrar', '/cadastro', '/onboarding', '/nova-senha', '/verificar'],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
