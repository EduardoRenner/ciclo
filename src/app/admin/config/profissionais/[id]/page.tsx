import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarExpediente } from '@/server/services/expediente'
import { listarFolgas } from '@/server/services/folgas'
import { listarProfissionais } from '@/server/services/profissionais'

import EditorExpediente from '@/components/config/editor-expediente'
import PageHeader from '@/components/ui/page-header'

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
      <PageHeader titulo={profissional.display_name} descricao="Expediente e folgas." />

      <EditorExpediente professionalId={id} expedienteInicial={expediente} folgasIniciais={folgas} />
    </>
  )
}
