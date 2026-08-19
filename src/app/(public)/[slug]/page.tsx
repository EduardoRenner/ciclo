import { notFound } from 'next/navigation'

import { AppError } from '@/server/http/errors'
import { perfilPublico } from '@/server/services/public-booking'

import SecoesPublicas from './secoes'

import type { Metadata, Viewport } from 'next'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const perfil = await perfilPublico(slug).catch(() => null)
  if (!perfil) return {}

  return {
    title: perfil.name,
    description: perfil.tagline ?? perfil.about ?? `Agende seu horário na ${perfil.name}.`,
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

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] px-[18px]">
      <SecoesPublicas perfil={perfil} />
    </main>
  )
}
