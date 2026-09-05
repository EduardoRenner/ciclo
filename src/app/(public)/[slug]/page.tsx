import { notFound } from 'next/navigation'

import { dadosEstruturadosDoSalao } from '@/core/seo/dados-estruturados'
import { ehDemonstracao } from '@/core/tenants/demonstracao'
import { AppError } from '@/server/http/errors'
import { perfilPublico } from '@/server/services/public-booking'

import SecoesPublicas from './secoes'

import type { Metadata, Viewport } from 'next'

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
    /*
      Defesa em profundidade, no mesmo padrão que `/admin` já usa: o `sitemap.ts` já deixa o
      tenant de demonstração de fora, mas buscador não descobre página só por sitemap — basta um
      link em qualquer lugar. `noindex` fecha o caminho que sobrou.
    */
    robots: ehDemonstracao(perfil.slug) ? { index: false, follow: false } : undefined,
    alternates: url ? { canonical: url } : undefined,
    // A capa (1600x600, boa proporção de OG) ou, na falta dela, o logo: o card que o salão manda
    // no WhatsApp e cola na bio do Instagram passa a mostrar a marca dele, não só texto. Ambos já
    // são URL absoluta (`urlDaVitrine` monta a partir do host do Supabase). Sem nenhum dos dois,
    // `images` sai `undefined` e o card volta a ser só título + descrição.
    openGraph: {
      title: perfil.name,
      description: descricao,
      url,
      type: 'website',
      locale: 'pt_BR',
      images: perfil.coverUrl ?? perfil.logoUrl ?? undefined,
    },
    twitter: { card: perfil.coverUrl ? 'summary_large_image' : 'summary', title: perfil.name, description: descricao },
  }
}

export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  return { themeColor: perfil?.accentColor.acc ?? '#0d0c0c' }
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
  /*
    O tenant de DEMONSTRAÇÃO não recebe marcação: ele já é `noindex`, e entregar telefone,
    endereço e faixa de preço de um negócio que não existe é exatamente o que a regra do
    `sitemap.ts` e do `robots` da página evitam pelos outros caminhos.
  */
  const dados = ehDemonstracao(perfil.slug)
    ? null
    : dadosEstruturadosDoSalao({
        nome: perfil.name,
        url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/${perfil.slug}`,
        vertical: perfil.vertical,
        descricao: perfil.tagline ?? perfil.about,
        telefone: perfil.phone,
        endereco: perfil.address,
        instagram: perfil.instagram,
        servicos: perfil.services.map((x) => ({ name: x.name, priceCents: x.priceCents, pricingModel: x.pricingModel })),
        avaliacoes: perfil.reviews,
        // A capa representa o negócio melhor que o logo no cartão do buscador; o logo é a reserva
        // de quem só subiu marca. Os dois já vêm de `perfilPublico`, montados por `urlDaVitrine`.
        imagem: perfil.coverUrl ?? perfil.logoUrl,
        horarios: perfil.hours,
      })

  // `JSON.stringify` não escapa `</script>` — nome/endereço do tenant são texto livre
  // no cadastro, então sem isso um valor malicioso fecharia a tag e injetaria HTML.
  const jsonLd = dados ? JSON.stringify(dados).replace(/</g, '\\u003c') : null

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
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} /> : null}
      {/*
        O aviso é o que protege quem chega DIRETO pela URL — por um link no WhatsApp, um print,
        um resultado antigo de busca. O `sitemap` e o `noindex` só cuidam do buscador; nenhum dos
        dois alcança essa pessoa. Sem ele, dá para escolher serviço e horário numa barbearia que
        não existe e ficar esperando um atendimento que nunca vai acontecer.

        Fica ANTES do conteúdo de propósito: aviso depois do formulário chega tarde demais.
      */}
      {ehDemonstracao(perfil.slug) ? (
        <p
          role="status"
          className="mt-4 rounded-[var(--radius-sm)] border border-line-2 bg-surface-2 px-4 py-3 text-secundario text-txt-2"
        >
          <span className="font-semibold text-txt">Página de exemplo do CICLO.</span> Este
          estabelecimento não existe e nenhum horário marcado aqui será atendido, e ela está no ar
          para mostrar como fica a página de quem usa o sistema.
        </p>
      ) : null}
      <SecoesPublicas perfil={perfil} />
    </main>
  )
}
