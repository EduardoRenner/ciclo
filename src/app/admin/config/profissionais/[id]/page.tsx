import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import BloqueioPlano from '@/components/ui/bloqueio-plano'
import { podeUsarModulo } from '@/core/billing/planos'
import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarExpediente } from '@/server/services/expediente'
import { listarFolgas } from '@/server/services/folgas'
import { contextoDePlano } from '@/server/services/planos'
import { listarProfissionais } from '@/server/services/profissionais'

import EditorExpediente from '@/components/config/editor-expediente'
import PageHeader from '@/components/ui/page-header'

export const metadata = { title: "Profissional" }

export default async function PaginaExpediente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await contextoAtual(new Request(`https://interno/config/profissionais/${id}`, { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [profissionais, expediente, folgas, plano] = await Promise.all([
    listarProfissionais(db, ctx.tenantId, true),
    listarExpediente(db, ctx.tenantId, id),
    listarFolgas(db, ctx.tenantId, id),
    contextoDePlano(db, ctx.tenantId),
  ])

  const profissional = profissionais.find((p) => p.id === id)
  if (!profissional) notFound()

  /*
   * `PUT /professionals/[id]/business-hours` exige o módulo `team` (Equipe) quando o
   * `professionalId` não é nulo, que é exatamente o caso desta tela. Sem o aviso, a pessoa
   * mexia nos horários e cada toque voltava atrás com um toast de erro — agora o editor desfaz
   * de verdade, mas descobrir a trava tentando continua sendo a pior forma de descobrir.
   *
   * O expediente do NEGÓCIO (`/admin/config/horarios`, `professionalId: null`) não passa por
   * aqui e continua liberado em todo degrau, que é o caminho de quem atende sozinho.
   */
  const bloqueado = podeUsarModulo(plano, 'team').estado !== 'liberado'

  return (
    <>
      <PageHeader titulo={profissional.display_name} descricao="Expediente e folgas." />

      {bloqueado ? (
        <BloqueioPlano
          className="mb-4"
          precisaDo="equipe"
          acao="dar um expediente próprio a cada profissional"
          alternativa={<Link href="/admin/config/horarios">Definir o horário do negócio inteiro</Link>}
        />
      ) : null}

      <EditorExpediente professionalId={id} expedienteInicial={expediente} folgasIniciais={folgas} />
    </>
  )
}
