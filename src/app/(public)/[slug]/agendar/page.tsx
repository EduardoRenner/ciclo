import { notFound } from 'next/navigation'

import { AppError } from '@/server/http/errors'
import { perfilPublico } from '@/server/services/public-booking'

import Agendar from './agendar'

import type { Metadata } from 'next'

/**
 * Esta é a página que o salão cola na bio do Instagram e manda no WhatsApp —
 * e era a única do site público sem metadado próprio: o card do link saía com
 * "CICLO" e a descrição do produto, não com o nome de quem atende. `/{slug}`
 * já tinha isto desde o começo; aqui nunca foi feito.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  if (!perfil) return {}

  const titulo = `Agendar em ${perfil.name}`
  const descricao = `Escolha o serviço, o dia e o horário na ${perfil.name}. Sem ligar, sem esperar resposta.`
  const base = process.env.NEXT_PUBLIC_APP_URL
  const url = base ? `${base}/${perfil.slug}/agendar` : undefined

  return {
    title: titulo,
    description: descricao,
    alternates: url ? { canonical: url } : undefined,
    openGraph: { title: titulo, description: descricao, url, type: 'website', locale: 'pt_BR' },
    twitter: { card: 'summary', title: titulo, description: descricao },
  }
}

export default async function PaginaAgendar({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  // I-1, `docs/30-INDICACAO-PLANO.md`: `?ind=<token>` é o convite de indicação. Só string bruta
  // aqui — a verificação inteira (escopo, expiração, existência) é do servidor, no `POST book`.
  searchParams: Promise<{ ind?: string }>
}) {
  const { slug } = await params
  const { ind } = await searchParams

  const perfil = await perfilPublico(slug).catch((erro: unknown) => {
    if (erro instanceof AppError && erro.code === 'NOT_FOUND') return null
    throw erro
  })
  if (!perfil) notFound()

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-[18px] py-8">
      <header className="mb-6">
        <h1 className="text-titulo font-bold">Agendar em {perfil.name}</h1>
      </header>

      <Agendar
        slug={slug}
        nomeDoSalao={perfil.name}
        enderecoDoSalao={perfil.address}
        timezone={perfil.timezone}
        hours={perfil.hours}
        services={perfil.services}
        professionals={perfil.professionals}
        ind={ind ?? null}
      />
    </main>
  )
}
