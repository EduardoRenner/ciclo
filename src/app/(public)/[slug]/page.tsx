import { notFound } from 'next/navigation'

import { AppError } from '@/server/http/errors'
import { perfilPublico } from '@/server/services/public-booking'

import SecoesPublicas from './secoes'

import type { Metadata, Viewport } from 'next'
import type { PerfilPublico } from '@/server/services/public-booking'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  if (!perfil) return {}

  const descricao = perfil.tagline ?? perfil.about ?? `Agende seu horário na ${perfil.name}.`
  const base = process.env.NEXT_PUBLIC_APP_URL
  const url = base ? `${base}/${perfil.slug}` : undefined

  return {
    title: perfil.name,
    description: descricao,
    alternates: url ? { canonical: url } : undefined,
    // Sem foto/logo cadastrada ainda (nenhum tenant tem esse campo hoje) — título e
    // descrição já melhoram o card do WhatsApp/Facebook mesmo sem imagem própria.
    openGraph: { title: perfil.name, description: descricao, url, type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary', title: perfil.name, description: descricao },
  }
}

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  return { themeColor: perfil?.accentColor.acc ?? '#0d0c0c' }
}

/** LocalBusiness: o tipo genérico certo pra "profissional da beleza atende no endereço X". */
function jsonLdNegocioLocal(perfil: PerfilPublico) {
  const base = process.env.NEXT_PUBLIC_APP_URL
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: perfil.name,
    ...(base ? { url: `${base}/${perfil.slug}` } : {}),
    ...(perfil.phone ? { telephone: perfil.phone } : {}),
    ...(perfil.address ? { address: perfil.address } : {}),
    ...(perfil.tagline ?? perfil.about ? { description: perfil.tagline ?? perfil.about } : {}),
  }
}

export default async function PaginaPublica({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const perfil = await perfilPublico(slug).catch((erro: unknown) => {
    if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
    throw erro
  })
  if (!perfil) notFound()

  // `JSON.stringify` não escapa `</script>` — nome/endereço do tenant são texto livre
  // no cadastro, então sem isso um valor malicioso fecharia a tag e injetaria HTML.
  const jsonLd = JSON.stringify(jsonLdNegocioLocal(perfil)).replace(/</g, '\\u003c')

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-[18px]">
      {/*
        Sem `nonce` de propósito. `application/ld+json` não é executável, então
        `script-src` nunca o bloqueia — e passar o nonce quebrava a hidratação de
        toda página de salão: o navegador esconde o valor do atributo `nonce` do
        DOM (defesa contra exfiltração), o React compara com o que veio do
        servidor e acusa `nonce="…"` contra `nonce=""`. Medido ao vivo antes e
        depois: com o atributo, erro de hidratação em toda visita; sem ele, zero
        erro e zero violação de CSP.
      */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SecoesPublicas perfil={perfil} />
    </main>
  )
}
