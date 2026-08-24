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

/**
 * Achado ao ligar o CI pela primeira vez (S13, 2026-08-24): este arquivo nunca tinha sido
 * `build`ado fora de uma máquina com credencial real do Supabase. `revalidate = 3600` faz o Next
 * pré-renderizar a rota NO BUILD — e o job `Qualidade` do CI usa valores de fachada de propósito
 * (`docs/DECISOES.md`, PARTE 1 §4: "CI nunca fala com projeto real"), sem
 * `SUPABASE_SERVICE_ROLE_KEY` nenhuma. `withNovoTenant` estourava, e o build inteiro morria.
 *
 * Em produção de verdade a credencial sempre existe (conferido: está no Vercel), então este catch
 * nunca é o caminho quente lá — é rede só para o build sem banco. Mesmo padrão já registrado 3x
 * neste projeto para credencial ausente: "deixa passar e registra, nunca finge que funcionou,
 * nunca bloqueia por causa de config ausente".
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://ciclo.app'

  const tenants = await withNovoTenant(async (db) => {
    const { data } = await db.from('tenants').select('slug, created_at').is('deleted_at', null)
    return data ?? []
  }).catch((erro: unknown) => {
    console.warn(JSON.stringify({ level: 'warn', event: 'sitemap_sem_banco_no_build' }), erro)
    return []
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
