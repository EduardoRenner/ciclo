import { notFound } from 'next/navigation'

import { AppError } from '@/server/http/errors'
import { perfilPublico } from '@/server/services/public-booking'

import Agendar from './agendar'

export default async function PaginaAgendar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

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

      <Agendar slug={slug} services={perfil.services} professionals={perfil.professionals} />
    </main>
  )
}
