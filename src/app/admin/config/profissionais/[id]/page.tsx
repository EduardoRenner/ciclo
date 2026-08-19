import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarExpediente } from '@/server/services/expediente'
import { listarFolgas } from '@/server/services/folgas'
import { listarProfissionais } from '@/server/services/profissionais'

import EditorExpediente from '@/components/config/editor-expediente'

export default async function PaginaExpediente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request(`https://interno/config/profissionais/${id}`, { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [profissionais, expediente, folgas] = await Promise.all([
    listarProfissionais(db, ctx.tenantId, true),
    listarExpediente(db, ctx.tenantId, id),
    listarFolgas(db, ctx.tenantId, id),
  ])

  const profissional = profissionais.find((p) => p.id === id)
  if (!profissional) notFound()

  return (
    <>
      <header className="py-6">
        <h1 className="text-titulo font-extrabold">{profissional.display_name}</h1>
        <p className="mt-1 text-secundario text-txt-2">Expediente e folgas.</p>
      </header>

      <EditorExpediente professionalId={id} expedienteInicial={expediente} folgasIniciais={folgas} />
    </>
  )
}
