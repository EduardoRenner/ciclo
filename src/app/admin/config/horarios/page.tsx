import { headers } from 'next/headers'

import EditorExpediente from '@/components/config/editor-expediente'
import PageHeader from '@/components/ui/page-header'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarExpediente } from '@/server/services/expediente'
import { listarFolgas } from '@/server/services/folgas'

export const metadata = { title: "Horário de funcionamento" }

/**
 * Antes só existia expediente por profissional — o padrão do negócio
 * (`professional_id null`) só era alcançável direto pela API. É o que o
 * site público usa quando um profissional específico não tem horário
 * próprio cadastrado.
 */
export default async function PaginaHorarios() {
  const ctx = await contextoAtual(new Request('https://interno/admin/config/horarios', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [expediente, folgas] = await Promise.all([
    listarExpediente(db, ctx.tenantId, null),
    listarFolgas(db, ctx.tenantId, null),
  ])

  return (
    <>
      <PageHeader titulo="Horário de funcionamento" descricao="O padrão do negócio. Vale para quem não tem horário próprio cadastrado." />

      <EditorExpediente professionalId={null} expedienteInicial={expediente} folgasIniciais={folgas} />
    </>
  )
}
