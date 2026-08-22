import { withNovoTenant } from '@/server/db/with-tenant'

import type { MetadataRoute } from 'next'

/**
 * Cada tenant é uma página pública própria (`/[slug]`) — o "sitemap" real do
 * produto é a lista de estabelecimentos ativos, não um punhado de rotas
 * estáticas. Mesma leitura anônima do booking público: `withNovoTenant`
 * porque a RLS de `tenants` exige `has_tenant()`, que o gerador de sitemap
 * (sem sessão nenhuma) nunca tem — ver `public-booking.ts`.
 */
/**
 * O build carimbava este arquivo de uma vez: um salão que criasse conta depois
 * do deploy não entrava no sitemap até o próximo `vercel --prod` — e aqui os
 * deploys são manuais e esparsos, então "próximo deploy" pode ser semanas. Uma
 * hora de cache mantém a consulta longe de cada visita de crawler sem congelar
 * a lista.
 */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ciclo.app'

  const tenants = await withNovoTenant(async (db) => {
    const { data } = await db.from('tenants').select('slug, created_at').is('deleted_at', null)
    return data ?? []
  })

  return [
    { url: base, changeFrequency: 'monthly', priority: 0.5 },
    ...tenants.map((t) => ({
      url: `${base}/${t.slug}`,
      lastModified: t.created_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
