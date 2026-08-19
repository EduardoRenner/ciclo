import { headers } from 'next/headers'

import { contextoAtual } from '@/server/auth/tenant'
import { criarClienteDoUsuario } from '@/server/db/server-client'
import { listarModelos } from '@/server/services/mensagens-prontas'

import EditorModelos from './editor'
import PageHeader from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function PaginaMensagens() {
  const ctx = await contextoAtual(new Request('https://interno/config/mensagens', { headers: await headers() }))
  const db = await criarClienteDoUsuario()

  const [modelos, negocio] = await Promise.all([
    listarModelos(db, ctx.tenantId),
    db.from('tenants').select('name').eq('id', ctx.tenantId).single(),
  ])

  return (
    <>
      <PageHeader titulo="Mensagens prontas" descricao="Escreva uma vez, mande com um toque. Use as variáveis para o texto sair com o nome de cada cliente." />

      <EditorModelos iniciais={modelos} nomeDoNegocio={negocio.data?.name ?? ''} />
    </>
  )
}
